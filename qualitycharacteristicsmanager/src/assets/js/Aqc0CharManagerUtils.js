/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 * This file is used as utility file for characteristics manager from quality center foundation module
 *
 * @module js/Aqc0CharManagerUtils
 */
import AwPromiseService from 'js/awPromiseService';
import clientDataModel from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import soaSvc from 'soa/kernel/soaService';
import messagingSvc from 'js/messagingService';
import appCtxService from 'js/appCtxService';
import commandPanelService from 'js/commandPanel.service';
import viewModelObjectService from 'js/viewModelObjectService';
import commandService from 'js/command.service';
import localeService from 'js/localeService';
import editHandlerSvc from 'js/editHandlerService';
import tcVmoService from 'js/tcViewModelObjectService';
import _ from 'lodash';
import logger from 'js/logger';
import uwPropertySvc from 'js/uwPropertyService';
import tcSessionData from 'js/TcSessionData';
import aqc0CharLibTree from 'js/Aqc0CharLibraryTreeTableService';
import aqc0CharSpecOPSvc from 'js/Aqc0CharSpecOperationsService';
import aqc0UtilService from 'js/Aqc0UtilService';
import Aqc0CharManagerUtils2 from 'js/Aqc0CharManagerUtils2';
import aqc0CharLibraryUtilService from 'js/Aqc0CharLibraryUtilService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import { loadXrtData } from 'js/AwXrtService';
import _localeSvc from 'js/localeService';

var exports = {};

var saveEditHandler = {};

//character manager context key, Currently used to track the created objects
var _charManagerContext = 'charManagerContext';

// Indicate that allowed to attach (remove old and attach latest) latest specification to Inspection Definition.
appCtxService.registerCtx( 'isAllowedToUpdateLatestSpecification', true );

// Define the tc 13.2 onwards supported flag
appCtxService.registerCtx( 'isTC13_2OnwardsSupported', false );

var VAR_CHAR_TYPE = 'Qc0VariableCharSpec';
var VIS_CHAR_TYPE = 'Qc0VisualCharSpec';
var ATT_CHAR_TYPE = 'Qc0AttributiveCharSpec';
var CHAR_GROUP_TYPE = 'Qc0CharacteristicsGroup';
var CHAR_ELEMENT_REVISION = 'Aqc0CharElementRevision';
var ACTION_TYPE = 'Qam0QualityAction';
var FAILURE_TYPE = 'Qc0Failure';
var _data = null;
var isTypeChanged = false;
/**
 * Static XRT commands that should be active when the view model is visible.
 *
 */
var _staticXrtCommandIds = [ 'Awp0StartEdit', 'Awp0StartEditGroup', 'Awp0SaveEdits',
    'Awp0CancelEdits'
];

// If target object is valid then VALID_TO_DROP_OBJECT
const VALID_TO_DROP_OBJECT = {
    dropEffect: 'copy',
    preventDefault: true,
    stopPropagation: true
};
// If target object is invalid then INVALID_TO_DROP_OBJECT
const INVALID_TO_DROP_OBJECT = {
    dropEffect: 'none',
    stopPropagation: true
};

// To store the current source objects.
let dragDataCache = {
    draggedObjUids: [],
    draggedFromView: null
};

/**
 *This method ensures that the characteristic specification objects types are loaded before
 * the create panel is revealed.
 *
 * @param {String} commandId - Command Id for the Add Specification command
 * @param {String} location - Location of the Add Specification command
 */
export let getAddCharSpecificationPanel = function( commandId, location, context ) {
    Aqc0CharManagerUtils2.getCharSpecificationType( context );
    var typeNamesToLoad = [ VAR_CHAR_TYPE, VIS_CHAR_TYPE, ATT_CHAR_TYPE ];
    soaSvc.ensureModelTypesLoaded( typeNamesToLoad ).then( function() {
        let charType = appCtxService.getCtx( 'charSpecType' );
        if( charType === 'Qc0VariableCharSpec' ) {
            commandPanelService.activateCommandPanel( 'Aqc0AddVariableCharSpec', location, context, null, null, {
                isPinUnpinEnabled: true
            } );
        } else if( charType === 'Qc0AttributiveCharSpec' ) {
            commandPanelService.activateCommandPanel( 'Aqc0AddAttributiveCharSpec', location, context, null, null, {
                isPinUnpinEnabled: true
            } );
        } else if( charType === 'Qc0VisualCharSpec' ) {
            commandPanelService.activateCommandPanel( 'Aqc0AddVisualCharSpec', location, context, null, null, {
                isPinUnpinEnabled: true
            } );
        }
    } );
};

/**
 * This Method does the following:
 * 1) Gets the list of newly created specification objects by reading the 'charManagerContext.createdSpecifications' from ctx
 * 2) Prepares a list with the newly created objects at the top ( in case of multiple creation , the order is preserved )
 *
 * @param {ArrayList} loadedSpecifications list of specification objects as returned by server
 * @returns {ArrayList} list of specification objects with created objects at the top
 */
export let sortResults = function( loadedSpecifications ) {
    var charManagerCreateContext = appCtxService.getCtx( _charManagerContext + '.createdSpecifications' );
    if( charManagerCreateContext ) {
        var createOrderedObjects = loadedSpecifications.filter( function( mo ) {
            return charManagerCreateContext.indexOf( mo.uid ) !== -1;
        } ).sort( function( a, b ) {
            //context has oldest objects first
            return charManagerCreateContext.indexOf( b.uid ) - charManagerCreateContext.indexOf( a.uid );
        } );
        //Remove any created objects from the loaded specification objects and
        //keep the original ordering for anything that was not created
        var originalOrderingResults = loadedSpecifications.filter( function( mo ) {
            return charManagerCreateContext.indexOf( mo.uid ) === -1;
        } );
        // Create a Map with the model object uid as key and model object as value.
        var serverUidsMap = loadedSpecifications.reduce( function( acc, nxt ) {
            //filter duplicate objects if present
            if( !acc[ nxt.uid ] ) {
                acc[ nxt.uid ] = [];
            }
            acc[ nxt.uid ].push( nxt );
            return acc;
        }, {} );
        createOrderedObjects.forEach( function( mo, idx ) {
            //If the server response also contains this object
            if( serverUidsMap[ mo.uid ] ) {
                createOrderedObjects[ idx ] = serverUidsMap[ mo.uid ];
            }
        } );
        //Flatten - can't do within forEach as it messes up indices
        createOrderedObjects = createOrderedObjects.reduce( function( acc, nxt ) {
            if( Array.isArray( nxt ) ) {
                return acc.concat( nxt );
            }
            acc.push( nxt );
            return acc;
        }, [] );
        return createOrderedObjects.concat( originalOrderingResults );
    }
    return loadedSpecifications;
};

/**
 * This method first gets the qc0SpecificationList for characteristics group and loads the object
 *@returns {Object} promise
 */
export let loadObjects = function( subPanelContext ) {
    getSupportedTCVersion();
    var deferred = AwPromiseService.instance.defer();
    var loadChxObjectInput = {
        objects: [ subPanelContext.baseSelection ],
        attributes: [ 'qc0SpecificationList' ]
    };
    soaSvc.post( 'Core-2006-03-DataManagement', 'getProperties', loadChxObjectInput ).then( function( getPropertiesResponse ) {
        var updatedCharSpecUids = [];
        // eslint-disable-next-line array-callback-return
        Object.keys( getPropertiesResponse.modelObjects ).map( function( key ) {
            if( getPropertiesResponse.modelObjects[ key ].type === VIS_CHAR_TYPE || getPropertiesResponse.modelObjects[ key ].type === ATT_CHAR_TYPE ||
                getPropertiesResponse.modelObjects[ key ].type === VAR_CHAR_TYPE ) {
                updatedCharSpecUids.push( getPropertiesResponse.modelObjects[ key ].uid );
            }
        } );
        var specificationObjects = {
            uids: updatedCharSpecUids
        };
        if( specificationObjects.uids.length > 0 ) {
            exports.loadSpecifications( deferred, specificationObjects );
        } else {
            //If the group doesn't have any specifications then return an empty list
            var responseData = {
                totalLoaded: []
            };
            deferred.resolve( responseData );
        }
    }, function( reason ) {
        deferred.reject( reason );
    } );
    return deferred.promise;
};

/**
 * This method ensures that the s_uid in url is selected in the primary workarea.
 * This is required for selection sync of url and primary workarea
 * @param {ArrayList} searchState search/showobject location info object
 * @param {ArrayList} selectionModel selection model of pwa
 * @param pinUnpinnedFlag of panel
 */
export let processPWASelection = function( searchState, selectionModel, pinUnpinnedFlag ) {
    let searchData = { ...searchState.value };
    let ctx = appCtxService.getCtx();
    let ViewModeContextCtx = appCtxService.getCtx( 'ViewModeContext' );

    // If sublocation is CharacteristicsLibrarySubLocation and its List view then if user tried to add char specs then group was not selecting
    // therefore we are restricting the  selectionModel.setSelection() call. Current group should be selected
    if( ctx.selected ) {
        let isQc0CharacteristicsGroup = ctx.selected.modelType.typeHierarchyArray.indexOf( 'Qc0CharacteristicsGroup' ) > -1;
        if( ViewModeContextCtx && ViewModeContextCtx.ViewModeContext === 'SummaryView' && ctx.locationContext['ActiveWorkspace:SubLocation'] === 'CharacteristicsLibrarySubLocation' && isQc0CharacteristicsGroup  )     {
            return;
        }
    }

    if ( !pinUnpinnedFlag &&  searchData.newlyCreatedObjectFromCharLib ) {
        selectionModel.setSelection( searchData.newlyCreatedObjectFromCharLib );
    }else if( !searchData.newlyCreatedObjectFromCharLib && searchData.selectionQueryParam && searchData.selectionQueryParam.value ) {
        var pwaSelectionUid = [];
        pwaSelectionUid.push( searchData.selectionQueryParam.value );
        if ( pwaSelectionUid.length > 0 ) { selectionModel.setSelection( pwaSelectionUid ); }
    }

    if( isTypeChanged === true ) {
        selectionModel.setSelection( [] );
        isTypeChanged = false;
    }
    //TODO: Revisite required
    //For Edit operation needs to be exwcute edit commnad.
    // if(searchData.newlyCreatedObjectFromCharLib.type === 'Acp0Rule' || searchData.newlyCreatedObjectFromCharLib.type === 'Aqc0NamingConvention') {
    //     aqc0CharLibraryUtilService.renderEditViewForObjects('ViewModeContext',runActionWithViewModel);
    // }
};
/**
 * This method is used to get the LOV values for the versioning panel.
 * @param {Object} response the response of the getLov soa
 * @returns {Object} value the LOV value
 */
export let getLOVList = function( response ) {
    appCtxService.registerCtx( 'Aqc0AddSpecificationsToRepresentaion', 'Aqc0AddSpecificationsToRepresentaion' );
    return response.lovValues.map( function( obj ) {
        return {
            propDisplayValue: obj.propDisplayValues.lov_values[ 0 ],
            propDisplayDescription: obj.propDisplayValues.lov_value_descriptions ? obj.propDisplayValues.lov_value_descriptions[ 0 ] : obj.propDisplayValues.lov_values[ 0 ],
            propInternalValue: obj.propInternalValues.lov_values[ 0 ]
        };
    } );
};
/**
 * This method is used to get the input for the versioning soa
 * @param {Object} data the data object from the view model
 * @param {Object} xrtContext for the current selected object
 * @returns {ArrayList} the arrayList of the object with input for versioning soa
 */
export let getVersionInputFEdit = function( data, dataFromEditHandler, selectedObject ) {
    //var ctxObj = appCtxService.ctx.selected;
    var modifiedViewModelProperties = dataFromEditHandler.getAllModifiedProperties();
    var modifiedPropsWithoutSubProp = dataFromEditHandler.getModifiedPropertiesMap( modifiedViewModelProperties );
    var modifiedProperties = [];
    // Prepare versionInput
    var versionInput = {
        clientId: 'AWClient',
        sourceSpecification: {
            type: selectedObject.type,
            uid: selectedObject.uid
        },
        data: {
            stringProps: {},
            intProps: {},
            doubleProps: {},
            tagArrayProps: {},
            tagProps: {
                qc0GroupReference: {
                    type: CHAR_GROUP_TYPE,
                    uid: selectedObject.props.qc0GroupReference.dbValues[ 0 ]
                }
            }
        }
    };

    //Below code is added because when panel opens, saveAs xrt changes the object name to the next id.This creates problem in messages after versioning.
    //To fix this object name is again assigned as selected object's object_name.
    if( !data.object_name ) {
        data.object_name = {};
        data.object_name.dbValues = [];
    }
    data.object_name.dbValue = selectedObject.props.object_name.dbValues[ 0 ];
    data.object_name.dbValues[ 0 ] = data.object_name.dbValue;

    versionInput.data.stringProps.object_name = selectedObject.props.object_name.dbValues[ 0 ];
    versionInput.data.intProps.qc0BasedOnId = Number( selectedObject.props.qc0BasedOnId.dbValues[ 0 ] ) + 1;
    versionInput.data.tagProps.qc0GroupReference = {
        type: CHAR_GROUP_TYPE,
        uid: selectedObject.props.qc0GroupReference.dbValues[ 0 ]
    };
    //For Common properties
    for( var i in modifiedPropsWithoutSubProp ) {
        modifiedPropsWithoutSubProp[ i ].viewModelProps.forEach( function( modifiedVMProperty ) {
            modifiedProperties.push( modifiedVMProperty.propertyName );
            if( modifiedVMProperty.propertyName === 'qc0Context' ) {
                versionInput.data.stringProps.qc0Context = modifiedVMProperty.dbValue;
            }

            if( modifiedVMProperty.propertyName === 'qc0Criticality' ) {
                versionInput.data.stringProps.qc0Criticality = modifiedVMProperty.dbValue;
            }

            if( modifiedVMProperty.propertyName === 'object_desc' ) {
                versionInput.data.stringProps.object_desc = modifiedVMProperty.dbValue;
            }

            //For Variable Type
            if( selectedObject.type === 'Qc0VariableCharSpec' ) {
                if( modifiedVMProperty.propertyName === 'qc0NominalValue' ) {
                    versionInput.data.doubleProps.qc0NominalValue = Number( modifiedVMProperty.dbValue );
                }
                if( modifiedVMProperty.propertyName === 'qc0LowerTolerance' ) {
                    versionInput.data.doubleProps.qc0LowerTolerance = Number( modifiedVMProperty.dbValue );
                }
                if( modifiedVMProperty.propertyName === 'qc0UpperTolerance' ) {
                    versionInput.data.doubleProps.qc0UpperTolerance = Number( modifiedVMProperty.dbValue );
                }
                if( modifiedVMProperty.propertyName === 'qc0UnitOfMeasure' ) {
                    versionInput.data.tagProps.qc0UnitOfMeasure = {
                        type: 'qc0UnitOfMeasure',
                        uid: modifiedVMProperty.dbValue
                    };
                }
            }
            //For Attributive Type
            if( selectedObject.type === 'Qc0AttributiveCharSpec' ) {
                if( modifiedVMProperty.propertyName === 'qc0NokDescription' ) {
                    versionInput.data.stringProps.qc0NokDescription = modifiedVMProperty.dbValue;
                }
                if( modifiedVMProperty.propertyName === 'qc0OkDescription' ) {
                    versionInput.data.stringProps.qc0OkDescription = modifiedVMProperty.dbValue;
                }
            }
            //For Visual Type
            if( selectedObject.type === 'Qc0VisualCharSpec' ) {
                var imageDataset = [];
                if( modifiedVMProperty.propertyName === 'qc0GridRows' ) {
                    versionInput.data.intProps.qc0GridRows = Number( modifiedVMProperty.dbValue );
                }
                if( modifiedVMProperty.propertyName === 'qc0GridColumns' ) {
                    versionInput.data.intProps.qc0GridColumns = Number( modifiedVMProperty.dbValue );
                }
                if( selectedObject.props.IMAN_specification ) {
                    for( var id = 0; id < selectedObject.props.IMAN_specification.dbValues.length; id++ ) {
                        var hasImageDataset = {};
                        hasImageDataset.type = 'Image';
                        hasImageDataset.uid = selectedObject.props.IMAN_specification.dbValues[ id ];
                        imageDataset.push( hasImageDataset );
                    }
                }
                versionInput.data.tagArrayProps.qc0IMAN_specification = imageDataset;
            }
        } );
    }
    //For Common properties which are not modified
    if( modifiedProperties.indexOf( 'qc0Context' ) === -1 ) {
        versionInput.data.stringProps.qc0Context = selectedObject.props.qc0Context.dbValues[ 0 ];
    }
    if( modifiedProperties.indexOf( 'qc0Criticality' ) === -1 ) {
        versionInput.data.stringProps.qc0Criticality = selectedObject.props.qc0Criticality.dbValues[ 0 ];
    }
    if( modifiedProperties.indexOf( 'object_desc' ) === -1 ) {
        versionInput.data.stringProps.object_desc = selectedObject.props.object_desc.dbValues[ 0 ];
    }
    //For Variable Type props not modified
    if( selectedObject.type === 'Qc0VariableCharSpec' && _data ) {
        var nominalValue = _data.subPanelContext.selected.props.qc0NominalValue.dbValue;
        var lowerToleranceValue;
        var upperToleranceValue;
        if( appCtxService.ctx.isTC12_4OnwardsSupported ) {
            versionInput.data.stringProps.qc0limitation = _data.qc0limitation.dbValue;
            if( versionInput.data.stringProps.qc0limitation === 'Both Sides' ) {
                lowerToleranceValue = _data.subPanelContext.selected.props.qc0LowerTolerance.dbValue;
                upperToleranceValue = _data.subPanelContext.selected.props.qc0UpperTolerance.dbValue;
            } else if( versionInput.data.stringProps.qc0limitation === 'Zero' || versionInput.data.stringProps.qc0limitation === 'Down' ) {
                lowerToleranceValue = getToleranceValue( _data );
                upperToleranceValue = _data.subPanelContext.selected.props.qc0UpperTolerance.dbValue;
            } else if( versionInput.data.stringProps.qc0limitation === 'Up' ) {
                lowerToleranceValue = _data.subPanelContext.selected.props.qc0LowerTolerance.dbValue;
                upperToleranceValue = getToleranceValue( _data );
            }
        } else {
            lowerToleranceValue = _data.subPanelContext.selected.props.qc0LowerTolerance.dbValue;
            upperToleranceValue = _data.subPanelContext.selected.props.qc0UpperTolerance.dbValue;
        }
        if( appCtxService.ctx.isTC13_1OnwardsSupported ) {
            versionInput.data.stringProps.qc0ToleranceType = _data.subPanelContext.selected.props.qc0ToleranceType.dbValue;
        }

        versionInput.data.doubleProps.qc0NominalValue = Number( nominalValue );
        versionInput.data.doubleProps.qc0LowerTolerance = Number( lowerToleranceValue );
        versionInput.data.doubleProps.qc0UpperTolerance = Number( upperToleranceValue );
        versionInput.data.tagProps.qc0UnitOfMeasure = {
            type: 'qc0UnitOfMeasure',
            uid: _data.subPanelContext.selected.props.qc0UnitOfMeasure.dbValue
        };
    }
    //For Attributive Type  props not modified
    if( selectedObject.type === 'Qc0AttributiveCharSpec' ) {
        if( modifiedProperties.indexOf( 'qc0NokDescription' ) === -1 ) {
            versionInput.data.stringProps.qc0NokDescription = selectedObject.props.qc0NokDescription.dbValues[ 0 ];
        }
        if( modifiedProperties.indexOf( 'qc0OkDescription' ) === -1 ) {
            versionInput.data.stringProps.qc0OkDescription = selectedObject.props.qc0OkDescription.dbValues[ 0 ];
        }
    }
    //For Visual Type  props not modified
    if( selectedObject.type === 'Qc0VisualCharSpec' ) {
        var imageDataset = [];
        if( modifiedProperties.indexOf( 'qc0GridRows' ) === -1 ) {
            versionInput.data.intProps.qc0GridRows = Number( selectedObject.props.qc0GridRows.dbValues[ 0 ] );
        }
        if( modifiedProperties.indexOf( 'qc0GridColumns' ) === -1 ) {
            versionInput.data.intProps.qc0GridColumns = Number( selectedObject.props.qc0GridColumns.dbValues[ 0 ] );
        }
        if( selectedObject.props.IMAN_specification ) {
            for( var id = 0; id < selectedObject.props.IMAN_specification.dbValues.length; id++ ) {
                var hasImageDataset = {};
                hasImageDataset.type = 'Image';
                hasImageDataset.uid = selectedObject.props.IMAN_specification.dbValues[ id ];
                imageDataset.push( hasImageDataset );
            }
        }
        versionInput.data.tagArrayProps.qc0IMAN_specification = imageDataset;
    }
    //For carry forward the existing Actions on new Version
    var actions = [];
    if( selectedObject.props.Qc0HasActions ) {
        for( var qa = 0; qa < selectedObject.props.Qc0HasActions.dbValues.length; qa++ ) {
            var hasAction = {};
            hasAction.type = ACTION_TYPE;
            hasAction.uid = selectedObject.props.Qc0HasActions.dbValues[ qa ];

            actions.push( hasAction );
        }
    }
    versionInput.data.tagArrayProps.qc0Qc0HasActions = actions;
    var failures = [];
    if( selectedObject.props.Qc0HasFailures ) {
        for( var qf = 0; qf < selectedObject.props.Qc0HasFailures.dbValues.length; qf++ ) {
            var hasFailure = {};
            hasFailure.type = FAILURE_TYPE;
            hasFailure.uid = selectedObject.props.Qc0HasFailures.dbValues[ qf ];
            failures.push( hasFailure );
        }
    }
    versionInput.data.tagArrayProps.qc0Qc0HasFailures = failures;
    data.versionInputDataFVM = [ versionInput ];
    return [ versionInput ];
};
/**
 * This method is used to get the input for the versioning soa
 * @param {Object} data the data object from the view model
 * @param {Object} xrtContext for the current selected object
 * @returns {ArrayList} the arrayList of the object with input for versioning soa
 */
export let getVersionInput = function( data ) {
    let ctx = appCtxService.getCtx();
    var ctxObj = ctx.selected;
    // Prepare versionInput
    var versionInput = {
        clientId: 'AWClient',
        sourceSpecification: {
            type: ctxObj.type,
            uid: ctxObj.uid
        },
        data: {
            stringProps: {},
            intProps: {},
            doubleProps: {},
            tagArrayProps: {},
            tagProps: {
                qc0GroupReference: {
                    type: CHAR_GROUP_TYPE,
                    uid: ctxObj.props.qc0GroupReference.dbValues[ 0 ]
                }
            }
        }
    };
    //Below code is added because when panel opens, saveAs xrt changes the object name to the next id.This creates problem in messages after versioning.
    //To fix this object name is again assigned as selected object's object_name.
    if( !data.object_name ) {
        data.object_name = {};
        data.object_name.dbValues = [];
    }
    data.object_name.dbValue = ctx.selected.props.object_name.dbValues[ 0 ];
    data.object_name.dbValues[ 0 ] = data.object_name.dbValue;
    versionInput.data.stringProps.object_name = ctx.selected.props.object_name.dbValues[ 0 ];
    versionInput.data.stringProps.qc0Context = data.qc0Context.dbValue;
    versionInput.data.stringProps.qc0Criticality = data.qc0Criticality.dbValue;
    versionInput.data.intProps.qc0BasedOnId = Number( ctx.selected.props.qc0BasedOnId.dbValues[ 0 ] ) + 1;
    versionInput.data.tagProps.qc0GroupReference = {
        type: CHAR_GROUP_TYPE,
        uid: ctxObj.props.qc0GroupReference.dbValues[ 0 ]
    };
    //previous check of locationContext has been removed from condition as it would not work in Favorites
    if( ctx.selected.type === 'Qc0VariableCharSpec' ) {
        versionInput.data.doubleProps = {};
        versionInput.data.doubleProps.qc0NominalValue = Number( data.qc0NominalValue.dbValue );
        versionInput.data.doubleProps.qc0LowerTolerance = Number( data.qc0LowerTolerance.dbValue );
        versionInput.data.doubleProps.qc0UpperTolerance = Number( data.qc0UpperTolerance.dbValue );
        if( ctx.isTC13_1OnwardsSupported ) {
            versionInput.data.stringProps.qc0ToleranceType = data.qc0ToleranceType.dbValue;
        }
        versionInput.data.tagProps.qc0UnitOfMeasure = {
            type: 'qc0UnitOfMeasure',
            uid: data.qc0UnitOfMeasure.dbValue
        };
    }
    //previous check of locationContext has been removed from condition as it would not work in Favorites
    if( ctx.selected.type === 'Qc0AttributiveCharSpec' ) {
        versionInput.data.stringProps.qc0NokDescription = data.qc0NokDescription.dbValue;
        versionInput.data.stringProps.qc0OkDescription = data.qc0OkDescription.dbValue;
    }
    //For carry forward the existing Actions on new Version
    var actions = [];
    if( ctx.selected.props.Qc0HasActions ) {
        for( var qa = 0; qa < ctx.selected.props.Qc0HasActions.dbValues.length; qa++ ) {
            var hasAction = {};
            hasAction.type = ACTION_TYPE;
            hasAction.uid = ctx.selected.props.Qc0HasActions.dbValues[ qa ];

            actions.push( hasAction );
        }
    }
    versionInput.data.tagArrayProps.qc0Qc0HasActions = actions;

    var failures = [];
    if( ctx.selected.props.Qc0HasFailures ) {
        for( var qf = 0; qf < ctx.selected.props.Qc0HasFailures.dbValues.length; qf++ ) {
            var hasFailure = {};
            hasFailure.type = FAILURE_TYPE;
            hasFailure.uid = ctx.selected.props.Qc0HasFailures.dbValues[ qf ];
            failures.push( hasFailure );
        }
    }
    versionInput.data.tagArrayProps.qc0Qc0HasFailures = failures;

    if( ctx.selected.type === 'Qc0VisualCharSpec' ) {
        var imageDataset = [];
        versionInput.data.intProps.qc0GridRows = Number( data.qc0GridRows.dbValue );
        versionInput.data.intProps.qc0GridColumns = Number( data.qc0GridColumns.dbValue );
        if( ctx.selected.props.IMAN_specification ) {
            for( var id = 0; id < ctx.selected.props.IMAN_specification.dbValues.length; id++ ) {
                var hasImageDataset = {};
                hasImageDataset.type = 'Image';
                hasImageDataset.uid = ctx.selected.props.IMAN_specification.dbValues[ id ];
                imageDataset.push( hasImageDataset );
            }
        }
        versionInput.data.tagArrayProps.qc0IMAN_specification = imageDataset;
    }
    return [ versionInput ];
};

/**
 * Execute a command with the given arguments
 *
 * @param {String} commandId - Command id
 * @param {String|String[]} commandArgs
 */
export let openNewObject = function( commandId, commandArgs, commandContext ) {
    commandService.executeCommand( commandId, commandArgs, null, commandContext );
};

/**
 *This method ensures that the characteristic specification properties are loaded before
 * the create panel is revealed.
 *
 * @param {String} commandId - Command Id for the Add Specification command
 * @param {String} location - Location of the Add Specification command
 */
export let getSaveAsCharSpecificationPanel = function( commandId, location, context ) {
    getSupportedTCVersion();
    Aqc0CharManagerUtils2.getCharSpecificationType( context );
    var ctx = appCtxService.getCtx( );

    var isVariableChar = ctx.selected.type === 'Qc0VariableCharSpec';
    var isAttributiveChar = ctx.selected.type === 'Qc0AttributiveCharSpec';
    var isVisualChar = ctx.selected.type === 'Qc0VisualCharSpec';
    var props = [ 'qc0GroupReference', 'qc0Criticality', 'qc0Context', 'qc0BasedOnId', 'object_name' ];
    if( isVariableChar ) {
        props.push( 'qc0NominalValue' );

        if( appCtxService.getCtx( 'isTC13_1OnwardsSupported' ) ) {
            props.push( 'qc0ToleranceType' );
        }
        props.push( 'qc0UpperTolerance' );
        props.push( 'qc0LowerTolerance' );
        props.push( 'qc0UnitOfMeasure' );
    } else if( isAttributiveChar ) {
        props.push( 'qc0NokDescription' );
        props.push( 'qc0OkDescription' );
    } else if( isVisualChar ) {
        props.push( 'qc0GridRows' );
        props.push( 'qc0GridColumns' );
    }
    tcVmoService.getViewModelProperties( [ ctx.selected ], props ).then( function() {
        var typeNamesToLoad = [ CHAR_GROUP_TYPE ];
        soaSvc.ensureModelTypesLoaded( typeNamesToLoad ).then( function() {
            //let charType = appCtxService.getCtx( 'charSpecType' );
            if( ctx.charSpecType === 'Qc0VariableCharSpec' ) {
                commandPanelService.activateCommandPanel( 'Aqc0SaveAsVariableCharSpec', location );
            } else if( ctx.charSpecType === 'Qc0AttributiveCharSpec' ) {
                commandPanelService.activateCommandPanel( 'Aqc0SaveAsAttributiveCharSpec', location );
            } else if( ctx.charSpecType === 'Qc0VisualCharSpec' ) {
                commandPanelService.activateCommandPanel( 'Aqc0SaveAsVisualCharSpec', location );
            }
        } );
    } );
};

/**
 *This method ensures that the LOV value entered for the property Unit of Measure is valid
 *
 * @param {Object} data - data for the panel
 * @returns {Object} objectToReturn - whether the LOV is valid or not
 */
export let validateUnitofMeasure = function( data ) {
    var existingUom = [];
    var objectToReturn = {};
    _.forEach( data.unitOfMeasureList, function( uom ) {
        existingUom.push( uom.propDisplayValue );
    } );
    objectToReturn.isValid = _.indexOf( existingUom, data.qc0UnitOfMeasure.uiValue ) !== -1;
    if( objectToReturn.isValid ) {
        let unitOfMeasure = {
            uid: data.qc0UnitOfMeasure.dbValue,
            type: 'qc0UnitOfMeasure'
        };
        appCtxService.updateCtx( 'unitOfMeasure', unitOfMeasure );
    }
    return objectToReturn;
};

/**
 * For calling specific function
 * @param {data} data - For retrive the required data
 * @param {object} selectedObjFProp - selected Object
 */
export let performSaveEdit = function( data, deferred, selectedObjFProp, saveEditflag, subPanelContext ) {
    editHandlerSvc.setActiveEditHandlerContext( 'NONE' );
    var activeEditHandler = editHandlerSvc.getActiveEditHandler();
    var dataFromEditHandler = activeEditHandler.getDataSource();
    var modifiedViewModelPropertiesFC = dataFromEditHandler.getAllModifiedProperties();
    if( modifiedViewModelPropertiesFC.length > 0 || selectedObjFProp.modelType.typeHierarchyArray.indexOf( 'Qc0MasterCharSpec' ) > -1 ) {
        if( appCtxService.ctx.isTC13_2OnwardsSupported ) {
            var input = {};
            input.inputs = aqc0CharSpecOPSvc.createSaveEditSoaInput( dataFromEditHandler );
            aqc0CharSpecOPSvc.callSaveEditSoa( input ).then( function() {
                deferred.resolve();
                activeEditHandler.cancelEdits();
            }, function( error ) {
                deferred.reject();
                activeEditHandler.cancelEdits();
                throw error;
            } );
        }
        if( appCtxService.ctx.isTC13_2OnwardsSupported === false ) {
            exports.getVersionInputFEdit( data, dataFromEditHandler, selectedObjFProp );
            exports.createVersionSOACall( data, activeEditHandler, selectedObjFProp, saveEditflag, deferred, subPanelContext );
        }
    } else {
        activeEditHandler.cancelEdits();
    }
    return deferred.promise;
};

/**
 * This method is used to get the input for the versioning soa
 * @param {data} data  The view model data
 * @param activeEditHandler Active Edit Handler
 * @param selectedObject Selected Object
 * @param flagValue Save Edit Flag
 * @param deferred deferred
 */
export let createVersionSOACall = function( data, activeEditHandler, selectedObject, flagValue, deferred, subPanelContext ) {
    var inputData = {
        specificationInputs: data.versionInputDataFVM
    };
    soaSvc.post( 'Internal-CharManagerAW-2018-12-QualityManagement', 'createSpecificationVersion', inputData ).then( function( response ) {
        data.createdObject = response.specificationsOutput[ 0 ].newSpecification;
        data.createdObjects = data.createdObject;
        deferred.resolve( data.createdObjects );
        //
        aqc0CharLibraryUtilService.executePostVersionEventActionsForSpecifications( data.createdObjects, subPanelContext, true );
        //below line if block added for char library tree view selection of node.
        // if (appCtxService.ctx.ViewModeContext.ViewModeContext === 'TreeSummaryView') {
        //     aqc0CharLibTree.clearMapOfCharGroupAndSpecification();
        //     eventBus.publish('primaryWorkarea.reset');
        // }
        // if (appCtxService.ctx.ViewModeContext.ViewModeContext === 'TreeSummaryView' && flagValue === false) {
        //     appCtxService.ctx.createdObjectForTreeFromAddAction = data.createdObject;
        //     appCtxService.ctx.versionCreatedFlag = true;
        // }
        // if (appCtxService.ctx.ViewModeContext.ViewModeContext === 'TreeSummaryView' && flagValue) {
        //     appCtxService.ctx.createdObjectForTreeFromAddAction = undefined;
        //     appCtxService.ctx.versionCreatedFlag = true;
        // }
        // if (appCtxService.ctx.locationContext.modelObject === undefined && appCtxService.ctx.ViewModeContext.ViewModeContext !== 'TreeSummaryView') {
        //     eventBus.publish('cdm.relatedModified', {
        //         relatedModified: [
        //             selectedObject
        //         ]
        //     });
        // }
        // if (appCtxService.ctx.locationContext.modelObject !== undefined && flagValue === false && appCtxService.ctx.ViewModeContext.ViewModeContext !== 'TreeSummaryView') {
        //     eventBus.publish('cdm.relatedModified', {
        //         refreshLocationFlag: false,
        //         relatedModified: [
        //             appCtxService.ctx.locationContext.modelObject
        //         ],
        //         createdObjects: [data.createdObject]
        //     });
        // }
        // if (appCtxService.ctx.locationContext.modelObject !== undefined && flagValue && appCtxService.ctx.ViewModeContext.ViewModeContext !== 'TreeSummaryView') {
        //     eventBus.publish('cdm.relatedModified', {
        //         refreshLocationFlag: true,
        //         relatedModified: [
        //             appCtxService.ctx.locationContext.modelObject
        //         ]

        //     });
        // }
        // if (appCtxService.ctx.locationContext.modelObject !== undefined && appCtxService.ctx.locationContext.modelObject.modelType.typeHierarchyArray.indexOf('Qc0MasterCharSpec') > -1 &&
        //     flagValue === false) {
        //     var commandId = 'Awp0ShowObject';
        //     var commandArgs = {
        //         edit: false
        //     };
        //     var commandContext = {
        //         vmo: data.createdObject
        //     };
        //     exports.openNewObject(commandId, commandArgs, commandContext);
        // }
        if( response.specificationsOutput[ 0 ] ) {
            activeEditHandler.cancelEdits();
        }
    }, function( error ) {
        var errMessage = messagingSvc.getSOAErrorMessage( error );
        messagingSvc.showError( errMessage );
        activeEditHandler.cancelEdits();
        deferred.resolve();
    } )
        .catch( function( exception ) {
            logger.error( exception );
        } );
};

/**
 * Get save handler.
 *
 * @return Save Handler
 */
export let getSaveHandlerFCS = function() {
    return saveEditHandler;
};

/**
 * custom save handler save edits called by framework
 *
 * @return promise
 */
saveEditHandler.saveEdits = function( dataSource ) {
    var deferred = AwPromiseService.instance.defer();
    var vmo = dataSource.getDeclViewModel().vmo;
    var input = {};
    aqc0UtilService.getPropertiesforSelectedObject( dataSource.getDeclViewModel(), vmo, true, undefined, true, deferred, false, true );
    return deferred.promise;
};

/**
 * Returns dirty bit.
 * @returns {Boolean} isDirty bit
 */
saveEditHandler.isDirty = function( dataSource ) {
    var modifiedPropCount = dataSource.getAllModifiedProperties().length;
    if( modifiedPropCount === 0 ) {
        return false;
    }
    return true;
};

/**
 *This method ensures that the error message is thrown when the LOV value for the Unit of Measure is not Valid.
 */
export let throwValidationError = function() {
    var localTextBundle = localeService.getLoadedText( 'qualitycharacteristicsmanagerMessages' );
    messagingSvc.showError( localTextBundle.UnitOfMeasureError );
};

/**
 *This method ensures that the it return proper characteristics object to remove the relation from characteristics group
 */
export let getUnderlyingObject = function() {
    let ctx = appCtxService.getCtx();
    var selectedParent = {};
    if( ctx.pselected.modelType.typeHierarchyArray.indexOf( 'Aqc0QcElement' ) > -1 ) {
        selectedParent.type = ctx.pselected.type;
        selectedParent.uid = ctx.pselected.props.awb0UnderlyingObject.dbValues[ 0 ];
    } else {
        selectedParent = ctx.pselected;
    }
    return selectedParent;
};

/**


 *This method ensures that it used to create xrt view model for characteristics.
 * @param {object} subPanelContext
 * @param {object} charSpecObj
 * @param {boolean} isLatest
 */
export let getXrtViewModelForCharSpec = function( subPanelContext, charSpecObj, isLatest ) {
    var deferred = AwPromiseService.instance.defer();
    loadXrtData( charSpecObj, 'tc_xrt_Overview', 'SUMMARY' ).then(
        function( response ) {
            let xrtObj = response.activeTabContent.data.objects[ response.activeTabContent.data._selectedObject.uid ][ 0 ];
            if( charSpecObj.type === 'Qc0VariableCharSpec' && !appCtxService.ctx.isTC12_4OnwardsSupported && xrtObj.props.qc0limitation ) {
                xrtObj.props.qc0limitation.propertyDisplayName = null;
                xrtObj.props.qc0limitation.displayValues = null;
                xrtObj.props.qc0limitation.dbValue = null;
                xrtObj.props.qc0limitation.uiValue = null;
                xrtObj.props.qc0limitation.type = null;
            }
            if( charSpecObj.type === 'Qc0VariableCharSpec' && !appCtxService.ctx.isTC13_1OnwardsSupported && xrtObj.props.qc0ToleranceType ) {
                xrtObj.props.qc0ToleranceType.propertyDisplayName = null;
                xrtObj.props.qc0ToleranceType.displayValues = null;
                xrtObj.props.qc0ToleranceType.dbValue = null;
                xrtObj.props.qc0ToleranceType.uiValue = null;
                xrtObj.props.qc0ToleranceType.type = null;
            }
            let latestCharSpecxrtViewModel;
            let currentCharSpecxrtViewModel;
            if( isLatest ) {
                latestCharSpecxrtViewModel = { ...subPanelContext };
                latestCharSpecxrtViewModel.activeTab = {};
                latestCharSpecxrtViewModel.activeTab.extraInfo = response.extraInfo;
                latestCharSpecxrtViewModel.activeTab.tabContent = response.activeTabContent;

                //To view the char spec name in Inspection Definition characteristics tab
                latestCharSpecxrtViewModel.selected = charSpecObj;
                latestCharSpecxrtViewModel.selection = [ charSpecObj ];
                latestCharSpecxrtViewModel.showCharSpecInInspectionDefinition = {};
                latestCharSpecxrtViewModel.showCharSpecInInspectionDefinition.value = true;
                deferred.resolve( latestCharSpecxrtViewModel );
            } else {
                currentCharSpecxrtViewModel = { ...subPanelContext };
                currentCharSpecxrtViewModel.activeTab = {};
                currentCharSpecxrtViewModel.activeTab.extraInfo = response.extraInfo;
                currentCharSpecxrtViewModel.activeTab.tabContent = response.activeTabContent;

                //To view the char spec name in Inspection Definition characteristics tab
                currentCharSpecxrtViewModel.selected = charSpecObj;
                currentCharSpecxrtViewModel.selection = [ charSpecObj ];
                currentCharSpecxrtViewModel.showCharSpecInInspectionDefinition = {};
                currentCharSpecxrtViewModel.showCharSpecInInspectionDefinition.value = true;
                deferred.resolve( currentCharSpecxrtViewModel );
            }
        },
        function( reason ) {
            deferred.reject( reason );
        }
    );
    return deferred.promise;
};

/**
 *This method ensures that it used to load charestics and all the associate properties required to render xrt view model for charestics.
 */
export let loadCharesticsData = function( data, subPanelContext ) {
    let ctx = appCtxService.getCtx();
    appCtxService.registerCtx( 'isAllowedToUpdateLatestSpecification', true );
    getSupportedTCVersion();

    let returnObj = {};
    var deferred = AwPromiseService.instance.defer();
    var loadChxObjectInput = {
        objects: [ {
            type: 'Aqc0CharElementRevision',
            uid: ctx.selected.type === 'Aqc0QcElement' ? ctx.selected.props.awb0UnderlyingObject.dbValues[ 0 ] : appCtxService.ctx.selected.uid
        } ],
        attributes: [ 'Aqc0LinkToSpec' ]
    };
    data.charRepRev = loadChxObjectInput.objects[ 0 ];
    returnObj.charRepRev = data.charRepRev;
    soaSvc.post( 'Core-2006-03-DataManagement', 'getProperties', loadChxObjectInput ).then(
        function( getPropertiesResponse ) {
            var result = null;
            // eslint-disable-next-line array-callback-return
            let inspectionDefinition = null;
            Object.keys( getPropertiesResponse.modelObjects ).map( function( key ) {
                if( getPropertiesResponse.modelObjects[ key ].type === VIS_CHAR_TYPE || getPropertiesResponse.modelObjects[ key ].type === ATT_CHAR_TYPE ||
                    getPropertiesResponse.modelObjects[ key ].type === VAR_CHAR_TYPE ) {
                    result = getPropertiesResponse.modelObjects[ key ];
                }
                if ( getPropertiesResponse.modelObjects[key].type === CHAR_ELEMENT_REVISION ) {
                    inspectionDefinition = getPropertiesResponse.modelObjects[key];
                }
            } );
            data.currentCharSpec = result;
            returnObj.currentCharSpec = data.currentCharSpec;
            var currentCharSpecData = viewModelObjectService.constructViewModelObjectFromModelObject( result );
            if ( inspectionDefinition !== null && inspectionDefinition.props.is_modifiable.dbValues['0'] === '0' ) {
                appCtxService.registerCtx( 'isAllowedToUpdateLatestSpecification', false );
            }

            exports.getXrtViewModelForCharSpec( subPanelContext, currentCharSpecData, false ).then(
                function( response ) {
                    returnObj.currentCharSpecxrtViewModel = response;
                    if( currentCharSpecData.props.qc0IsLatest.dbValues[ 0 ] === '0' ) {
                        data.latestCharSpecxrtViewModel = null;
                        Aqc0CharManagerUtils2.findLatestCharVersion( subPanelContext, data, currentCharSpecData.props.object_name.dbValues[ 0 ] ).then( function( res ) {
                            if( res ) {
                                returnObj.latestCharSpecxrtViewModel = res.latestCharSpecxrtViewModel;
                                returnObj.latestCharSpec = res.latestCharSpec;
                            }
                            deferred.resolve( returnObj );
                        } );
                    } else {
                        deferred.resolve( returnObj );
                    }
                }
            );
        },
        function( reason ) {
            deferred.reject( reason );
        } );
    return deferred.promise;
};

/**
 *This method to used to remove latest view from xrt view model of charestics.
 */
export let closeCompareView = function( data ) {
    let newData = { ...data };
    newData.latestCharSpecxrtViewModel = null;
    return newData;
};

/**
 *This method to used to change selection.
 */
export let currentSelectionChanged = function( aqc0CharacteristicAndRuleEngineData, searchState ) {
    isTypeChanged = true;
    let ctx = appCtxService.getCtx();
    if( ctx.currentTypeSelection.dbValue !== aqc0CharacteristicAndRuleEngineData.dbValue ) {
        let searchData = { ...searchState.value };
        searchData.criteria.searchString = '';
        searchData.criteria.Type = aqc0CharacteristicAndRuleEngineData.dbValue;
        appCtxService.updateCtx( 'currentTypeSelection.dbValue', aqc0CharacteristicAndRuleEngineData.dbValue );
        appCtxService.updateCtx( 'currentTypeSelection.uiValue', aqc0CharacteristicAndRuleEngineData.dbValue );
        // This code is not fulfil the browser url update on selection. So commenting the function call to resolve test cases failure issues.
        //Aqc0CharManagerUtils2.addQueryParamsToBrowserURL();
        aqc0CharLibTree.clearMapOfCharGroupAndSpecification();
        if( ctx.charLibmanagercontext ) {
            appCtxService.updateCtx( 'charLibmanagercontext.selectedNodes', [] );
        }
        ///code is added to remove selection
        searchData.newlyCreatedObjectFromCharLib = undefined;
        searchData.selectionQueryParam.value = undefined;
        searchData.pwaSelection = undefined;
        searchState.update( { ...searchData } );
    }
};

/**
 * Function to get selected char library type.
 * @returns {object} ctx object with selected char library type
 */
export let getCurrentType = function() {
    let ctx = appCtxService.getCtx();
    getSupportedTCVersion();
    appCtxService.registerCtx( 'charLibmanagercontext', { sortCriteria: {} } );
    var currentTypeSelection;
    var charLibSelectedType = Aqc0CharManagerUtils2.getQueryParamValue( 'selectedType' );
    if( !charLibSelectedType ) {
        charLibSelectedType = ctx.currentTypeSelection && ctx.currentTypeSelection.dbValue;
    }
    if( charLibSelectedType ) {
        currentTypeSelection = {
            uiValue: charLibSelectedType,
            dbValue: charLibSelectedType
        };
    } else {
        currentTypeSelection = {
            uiValue: 'Characteristics',
            dbValue: 'Qc0CharacteristicsGroup'
        };
    }
    appCtxService.registerCtx( 'currentTypeSelection', currentTypeSelection );
    return appCtxService.ctx.currentTypeSelection.dbValue;
};

/**
 * Listen to edit events , if edit is about to happen then convert the custom rule properties into edit mode else disable edit mode and revert to initial values
 * @return {ObjectArray} data the data object in scope
 */
export let processEditData = function( subPanelContext ) {
    if( !appCtxService.ctx.isTC13_2OnwardsSupported ) {
        uwPropertySvc.setIsEditable( subPanelContext.selected.props.object_name, false );
    }
};

/**
 * Get Input for SaveAs variable Characteristics SOA
 * @param {Object} data - data object
 * @param {Object} type - action type
 * @return {input} inputData for removeChildren SOA
 */
export let createInputForVarCharSpec = function( data, type ) {
    var input = [];
    var lowerToleranceValue;
    var upperToleranceValue;
    var limitationValue;
    var nominalValue;
    var groupReference;
    nominalValue = Number( data.qc0NominalValue.dbValue );
    lowerToleranceValue = Number( data.qc0LowerTolerance.dbValue );
    upperToleranceValue = Number( data.qc0UpperTolerance.dbValue );
    input = [ {
        clientId: '',
        data: {
            boName: 'Qc0VariableCharSpec',
            stringProps: {
                qc0Criticality: data.qc0Criticality.dbValue,
                qc0Context: data.qc0Context.dbValue,
                object_desc: data.object_desc.dbValue
            },
            doubleProps: {
                qc0NominalValue: nominalValue,
                qc0UpperTolerance: upperToleranceValue,
                qc0LowerTolerance: lowerToleranceValue
            },
            tagProps: {
                qc0UnitOfMeasure: {
                    uid: data.qc0UnitOfMeasure.dbValue,
                    type: 'qc0UnitOfMeasure'
                }
            }
        }
    } ];
    if( type === 'create' ) {
        groupReference = {
            uid: appCtxService.getCtx( 'charGroupUid' ),
            type: appCtxService.getCtx( 'charGroupObjName' )
        };
    } else if( type === 'saveas' ) {
        groupReference = {
            type: data.GroupList.dbValue.type,
            uid: data.GroupList.dbValue.uid,
            name: data.GroupList.dbValue.props.object_string.dbValue
        };
    }
    input[ 0 ].data.tagProps.qc0GroupReference = groupReference;
    if( appCtxService.getCtx( 'isTC12_4OnwardsSupported' ) ) {
        limitationValue = data.qc0limitation.dbValue;

        if( limitationValue === 'Zero' || limitationValue === 'Down' ) {
            input[ 0 ].data.doubleProps.qc0LowerTolerance = Number( getToleranceValue( data ) );
        } else if( limitationValue === 'Up' ) {
            input[ 0 ].data.doubleProps.qc0UpperTolerance = Number( getToleranceValue( data ) );
        }
        input[ 0 ].data.stringProps.qc0limitation = limitationValue;
    }
    if( appCtxService.getCtx( 'isTC13_1OnwardsSupported' ) ) {
        input[ 0 ].data.stringProps.qc0ToleranceType = data.qc0ToleranceType.dbValue;
    }
    if( appCtxService.getCtx( 'isTC13_2OnwardsSupported' ) ) {
        input[ 0 ].data.stringProps.object_name = data.objectName.dbValue;
    } else if( !appCtxService.getCtx( 'isTC13_2OnwardsSupported' ) ) {
        input[ 0 ].data.stringProps.object_name = data.objectName.dbValue;
    }

    return input;
};

/**
 * Get Input for SaveAs variable Characteristics SOA
 * @param {Object} data - data
 * @return {saveAsInput} inputData for SaveAs SOA
 */
export let getSaveAsInputForCharSpec = function( data ) {
    var lowerToleranceValue;
    var upperToleranceValue;
    var limitationValue;
    var nominalValue;
    var saveAsInput = {};
    nominalValue = Number( data.qc0NominalValue.dbValue );
    lowerToleranceValue = Number( data.qc0LowerTolerance.dbValue );
    upperToleranceValue = Number( data.qc0UpperTolerance.dbValue );
    saveAsInput = {
        boName: 'Qc0VariableCharSpec',
        stringProps: {
            qc0Criticality: data.qc0Criticality.dbValue,
            qc0Context: data.qc0Context.dbValue,
            object_desc: data.object_desc.dbValue
        },
        doubleProps: {
            qc0NominalValue: nominalValue,
            qc0UpperTolerance: upperToleranceValue,
            qc0LowerTolerance: lowerToleranceValue
        },
        tagProps: {
            qc0UnitOfMeasure: {
                uid: data.qc0UnitOfMeasure.dbValue,
                type: 'qc0UnitOfMeasure'
            }
        },
        boolProps: {
            qc0IsLatest: true
        },
        intProps: {
            qc0BasedOnId: 1
        }
    };
    if( appCtxService.ctx.isTC12_4OnwardsSupported ) {
        limitationValue = data.qc0limitation.dbValue;

        if( limitationValue === 'Zero' || limitationValue === 'Down' ) {
            saveAsInput.doubleProps.qc0LowerTolerance = Number( getToleranceValue( data ) );
        } else if( limitationValue === 'Up' ) {
            saveAsInput.doubleProps.qc0UpperTolerance = Number( getToleranceValue( data ) );
        }
        saveAsInput.stringProps.qc0limitation = limitationValue;
    }

    if( appCtxService.ctx.isTC13_1OnwardsSupported ) {
        saveAsInput.stringProps.qc0ToleranceType = data.qc0ToleranceType.dbValue;
    }
    saveAsInput.stringProps.object_name = data.objectName.dbValue;

    return saveAsInput;
};

/*
 *  This method to updates Upper Tolerance and Lower Tolerance after changing Tolerance Type
 *
 */
export let updateUpperLowerTol = function( subPanelContext ) {
    getSupportedTCVersion();
    var activeEditHandler = editHandlerSvc.getActiveEditHandler();
    var upperTolValue = null;
    var lowerTolValue = null;

    //When Tolerance Type == Absolute
    if( activeEditHandler.editInProgress() ) {
        if( subPanelContext.fields.selected.properties.qc0ToleranceType.value === 'Absolute' ) {
            upperTolValue = Number( subPanelContext.fields.selected.properties.qc0NominalValue.value ) + Number( subPanelContext.fields.selected.properties.qc0UpperTolerance.value );
            lowerTolValue = Number( subPanelContext.fields.selected.properties.qc0NominalValue.value ) + Number( subPanelContext.fields.selected.properties.qc0LowerTolerance.value );
        }
        //When Tolerance Type == Relative
        if( subPanelContext.fields.selected.properties.qc0ToleranceType.value === 'Relative' ) {
            upperTolValue = Number( subPanelContext.fields.selected.properties.qc0UpperTolerance.value ) - Number( subPanelContext.fields.selected.properties.qc0NominalValue.value );
            lowerTolValue = Number( subPanelContext.fields.selected.properties.qc0LowerTolerance.value ) - Number( subPanelContext.fields.selected.properties.qc0NominalValue.value );
        }
        //If values are not null, then only assign

        let newXrtState = { ...subPanelContext.xrtState.getValue() };

        if( upperTolValue !== null ) {
            var uppTolActual = 0.0;
            uppTolActual = upperTolValue.toFixed( 12 );
            newXrtState.xrtVMO.props.qc0UpperTolerance.dbValue = parseFloat( uppTolActual );
            newXrtState.xrtVMO.props.qc0UpperTolerance.valueUpdated = true;
        }
        if( lowerTolValue !== null ) {
            var lowTolActual = 0.0;
            lowTolActual = lowerTolValue.toFixed( 12 );
            newXrtState.xrtVMO.props.qc0LowerTolerance.dbValue = parseFloat( lowTolActual );
            newXrtState.xrtVMO.props.qc0LowerTolerance.valueUpdated = true;
        }
        newXrtState.xrtVMO.props.qc0ToleranceType.dbValue = subPanelContext.fields.selected.properties.qc0ToleranceType.value;
        newXrtState.xrtVMO.props.qc0ToleranceType.valueUpdated = true;
        subPanelContext.xrtState.update( newXrtState );
    }
};
/**
 * Sets the supported versions for commands
 */
export let getSupportedTCVersion = function() {
    if( !appCtxService.ctx.isSuportedCheck ) {
        var tcMajor = tcSessionData.getTCMajorVersion();
        var tcMinor = tcSessionData.getTCMinorVersion();
        var isTC12_4OnwardsSupported = false;
        var isTC13_1OnwardsSupported = false;
        var isTC13_2OnwardsSupported = false;
        var isTC14_3OnwardsSupported = false;
        var isAW52_13XOnwardsSupported = false;
        // If major version is greater than 12 .e.g TC13x onwards, then set true
        if( tcMajor > 12 || tcMajor === 12 && tcMinor >= 4 ) {
            isTC12_4OnwardsSupported = true;
        }
        // If not 13.0 and if Major is 13 or above and minor is 0 and above
        if( tcMajor === 13 && tcMinor > 0 || tcMajor > 13 ) {
            isTC13_1OnwardsSupported = true;
        }
        // tc 13.2 onwards supported
        if( tcMajor === 13 && tcMinor >= 2 || tcMajor > 13 ) {
            isTC13_2OnwardsSupported = true;
        }

        // If major version is greater than 14 .e.g TC14x onwards, then set true
        if( tcMajor > 14 || tcMajor === 14 && tcMinor >= 3 ) {
            isTC14_3OnwardsSupported = true;
        }
        appCtxService.registerCtx( 'isTC12_4OnwardsSupported', isTC12_4OnwardsSupported );
        appCtxService.registerCtx( 'isTC13_1OnwardsSupported', isTC13_1OnwardsSupported );
        appCtxService.registerCtx( 'isTC13_2OnwardsSupported', isTC13_2OnwardsSupported );
        appCtxService.registerCtx( 'isTC14_3OnwardsSupported', isTC14_3OnwardsSupported );
        appCtxService.registerCtx( 'isAW52_13XOnwardsSupported', Aqc0CharManagerUtils2.isAw5213xOrAboveVersionSupported() );
        appCtxService.registerCtx( 'isSuportedCheck', true );
    }
};

/**
 * Get Error from server and show on UI
 */
export let getFailureMessage = function( data ) {
    if( data.ServiceData.hasOwnProperty( 'partialErrors' ) ) {
        let errorCodeData = data.ServiceData.partialErrors[ 0 ].errorValues;
        for( let errdata in errorCodeData ) {
            if( errorCodeData[ errdata ].code === 394002 ) {
                messagingSvc.showError( errorCodeData[ errdata ].message );
                break;
            }
        }
    }
};

/*
 * This function will return Upper / Lower Tolerance value based on Tolerance Type
 * while doing save as we are handling Upper / Lower Tolerance value so that it won't be blank while doing save as or save edit
 * when tolerance== Absolute then upper tol and lower tol should be nominal val + upper tol / lower tol(in this case upper tol / lower tol value would be 0)
 * when tolerance== relative then upper tol and lower tol should be upper tol / lower tol(in this case upper tol / lower tol value would be 0) -nominal val
 */
export let getToleranceValue = function( data ) {
    let isTC13_1OnwardsSupported = appCtxService.getCtx( 'isTC13_1OnwardsSupported' );
    if( isTC13_1OnwardsSupported && data.qc0ToleranceType.dbValue === 'Absolute' ) {
        return data.qc0NominalValue.dbValue;
    }
    return 0;
};

/*
 * This function load the specifications
 */
export let loadSpecifications = function( deferred, specificationObjects ) {
    var policyIdLibObj = propertyPolicySvc.register( getPopertyPolicyInCharLib() );
    soaSvc.post( 'Core-2007-09-DataManagement', 'loadObjects', specificationObjects ).then( function( response ) {
        if( policyIdLibObj ) {
            propertyPolicySvc.unregister( policyIdLibObj );
        }
        var values = response.plain.map( function( Objuid ) {
            return response.modelObjects[ Objuid ];
        } );
        // Convert the loaded model objects into viewmodel objects
        var viewModelObjects = [];
        for( var i = 0; i < values.length; i++ ) {
            viewModelObjects[ i ] = viewModelObjectService.constructViewModelObjectFromModelObject( values[ i ] );
        }
        values = viewModelObjects;
        var responseData = {
            totalLoaded: exports.sortResults( values )
        };
        deferred.resolve( responseData );
    }, function( reason ) {
        deferred.reject( reason );
    } );
};

/**
 * This method to call for property policy for Characteristics Library
 */
export let getPopertyPolicyInCharLib = function() {
    return {
        types: [ {
            name: 'Qc0CharacteristicsGroup',
            properties: [ {
                name: 'qc0CharacteristicsType'
            },
            {
                name: 'qc0SpecificationList',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            }
            ]
        },
        {
            name: 'Acp0Rule',
            properties: [ {
                name: 'acp0RuleCondition',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'acp0DefaultAttNamingConv',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'acp0DefaultVarNamingConv',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'acp0DefaultVisNamingConv',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            }
            ]
        },
        {
            name: 'Acp0NamingConvention',
            properties: [ {
                name: 'acp0SourceClassType'
            },
            {
                name: 'acp0SelectedAttributes'
            },
            {
                name: 'acp0NamingConvention'
            },
            {
                name: 'acp0SourceClassAttribute'
            }
            ]
        },
        {
            name: 'Qc0MasterCharSpec',
            properties: [ {
                name: 'qc0BasedOnId'
            },
            {
                name: 'Qc0HasFailures',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'Qc0HasActions',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'qc0GroupReference',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'IMAN_specification'
            },
            {
                name: 'qc0Context'
            },
            {
                name: 'qc0IsLatest'
            }
            ]
        },
        {
            name: 'Qc0VariableCharSpec',
            properties: [ {
                name: 'qc0Criticality'
            },
            {
                name: 'qc0limitation'
            },
            {
                name: 'qc0LowerTolerance'
            },
            {
                name: 'qc0NominalValue'
            },
            {
                name: 'qc0ToleranceType'
            }
            ]
        }
        ]
    };
};

/**
 * Get deppCopy data or SaveAs input.
 * @param {*} selectedObj
 * @returns
 */
export let getSaveAsDeepCopyInput = function( selectedObj ) {
    var deferred = AwPromiseService.instance.defer();
    var inputData = {
        deepCopyDataInput: [ {
            businessObject: selectedObj,
            operation: 'SaveAs'
        } ]
    };
    //Calling deepCopy SOA
    soaSvc.post( 'Core-2014-10-DataManagement', 'getDeepCopyData', inputData ).then( ( response ) => {
        if( response ) {
            let newDeepCopyData = aqc0CharSpecOPSvc.convertDeepCopyData( response.deepCopyInfoMap[ 1 ][ 0 ], true );
            return deferred.resolve( newDeepCopyData );
        }
    }, function( reason ) {
        deferred.reject( reason );
    } );

    return deferred.promise;
};

//Clear the local dragged objects cache as soon as dran and drop action completes.
const _clearDragDataCache = () => {
    dragDataCache.draggedObjects = [];
    dragDataCache.draggedObjUids = [];
    dragDataCache.draggedFromView = null;
    dragDataCache.draggedObjectsPciInfo = [];
};

/**
 * Get all objects selected to drop on target
 * @returns {Objects} Source objects that are being dropped.
 */
var _getDraggedObjects = function( ) {
    const sourceObjects = [];

    for( let i = 0; i < dragDataCache.draggedObjUids.length; i++ ) {
        if( dragDataCache.draggedObjUids[i] !== 'undefined' && dragDataCache.draggedObjUids[i] !== null ) {
            const draggedObject = clientDataModel.getObject( dragDataCache.draggedObjUids[ i ] );
            if( draggedObject !== undefined && draggedObject !== null ) {
                sourceObjects.push( draggedObject );
            }
        }
    }
    return sourceObjects;
};


/**
 * Drag and drop functionality for cut and paste the object in the tree view
 * @param{ModelObject} targetObject Parent to which the object is to be pasted
 * @param{ModelObject} sourceObjects object to be pasted
 */
export let setPropertiesForPaste = function(   subPanelContext, charLibraryDataProvider, dragAndDropParams ) {
    var deferred = AwPromiseService.instance.defer();
    var targetObject  = dragAndDropParams.targetObjects[0];
    var sourceObjects = [];
    sourceObjects = _getDraggedObjects();
    _clearDragDataCache();
    var inputData = [];
    var selectedParent = appCtxService.getCtx( 'pselected' );

    // If user drag from multiples groups then store the groups uid
    var selectedParentUids = [];
    sourceObjects.forEach( function( value ) {
        selectedParentUids.push( value.props.qc0GroupReference.dbValues[0]   );
    } );

    var subLocationContext = appCtxService.ctx.locationContext['ActiveWorkspace:SubLocation'];

    if( targetObject.modelType.typeHierarchyArray.indexOf( 'Qc0CharacteristicsGroup' ) > -1 && sourceObjects.length > 0 &&  subLocationContext === 'CharacteristicsLibrarySubLocation'  ) {
        _.forEach( sourceObjects, function( sourceObject ) {
            if( targetObject.modelType.typeHierarchyArray.indexOf( 'Qc0CharacteristicsGroup' ) > -1 && (
                sourceObject.modelType.typeHierarchyArray.indexOf( 'Qc0VariableCharSpec' ) > -1 ||
                sourceObject.modelType.typeHierarchyArray.indexOf( 'Qc0VisualCharSpec' ) > -1 ||
                sourceObject.modelType.typeHierarchyArray.indexOf( 'Qc0AttributiveCharSpec' ) > -1 )
                && targetObject.uid !== sourceObject.uid ) {
                var input = {
                    options: [],
                    object: sourceObject,
                    timestamp: '',
                    vecNameVal: [ {
                        name: 'qc0GroupReference',
                        values: [ targetObject.uid ]
                    } ]
                };
                inputData.push( input );
            }
        } );
        soaSvc.post( 'Core-2010-09-DataManagement', 'setProperties', {
            info: inputData
        } ).then(
            function(  ) {
                deferred.resolve();
                if ( selectedParentUids.length > 0 ) {
                    aqc0CharLibTree.updateDraDropNodes(  sourceObjects, selectedParentUids, targetObject,  charLibraryDataProvider, subPanelContext );
                } else {
                    aqc0CharLibTree.clearMapOfCharGroupAndSpecification();
                    eventBus.publish( 'primaryWorkarea.reset' );
                }
                eventBus.publish( 'dragDrop.success', {
                    sourceObjects: sourceObjects,
                    targetObject :targetObject
                } );
            },
            function( error ) {
                var errMessage = messagingSvc.getSOAErrorMessage( error );
                messagingSvc.showError( errMessage );
                deferred.reject( error );

                // If user select multiple specs of different type and drop into group
                // then only specs that group type is match with target group will be moved.
                // So here error.cause.updated contains updated specs.
                if( error.cause.updated && error.cause.updated.length > 0 ) {
                    var updatedObjs = [];
                    error.cause.updated.forEach( element => {
                        sourceObjects.forEach( srcElement => {
                            if( srcElement.uid === element ) {
                                updatedObjs.push( srcElement );
                            }
                        } );
                    } );

                    eventBus.publish( 'dragDrop.success', {
                        sourceObjects:  updatedObjs,
                        targetObject :targetObject
                    } );
                }

                if( selectedParent !== undefined ) {
                    eventBus.publish( 'cdm.relatedModified', {
                        relatedModified: [ selectedParent, targetObject ]
                    } );
                } else {
                    aqc0CharLibTree.clearMapOfCharGroupAndSpecification();
                    eventBus.publish( 'primaryWorkarea.reset' );
                }
            }
        );
    } else {
        var resource = 'qualityfailuremanagerMessages';
        var localTextBundle = _localeSvc.getLoadedText( resource );
        var errorMessage = localTextBundle.Aqc0FailureSpecDragDropFailed;
        messagingSvc.showError( errorMessage );
    }
    return deferred.promise;
};

export let dragStartActionForQc0MasterCharSpec = function( dragAndDropParams ) {
    if( appCtxService.getCtx( 'isTC14_3OnwardsSupported' ) ) {
        var isValidSpecs =  true;

        // If user selects chars specs and group as well then drag command should be disable
        dragAndDropParams.targetObjects.forEach( element => {
            if( element.modelType.typeHierarchyArray.indexOf( 'Qc0CharacteristicsGroup' ) > -1  ) {
                isValidSpecs = false;
            }
        } );

        if( isValidSpecs && dragAndDropParams && dragAndDropParams.targetObjects ) {
            dragDataCache.draggedObjects = dragAndDropParams.targetObjects;
            dragDataCache.draggedObjUids = dragAndDropParams.targetObjects.map( object => object.uid );

            dragDataCache.draggedFromView = dragAndDropParams.declViewModel._internal.viewId;
        } else {
            dragAndDropParams.event.preventDefault();
        }
    }
    return {
        preventDefault: false
    };
};

/**
 * @param {Array} sourceViews Array of views
 * @param {Array} types Array of source types
 * @param {Boolean} readOnlyMode readonly flag
 * @param {Object} dropData objects
 * @returns {Object} config for preventing default action
 */
function dragOverActionForQc0MasterCharSpec( sourceViews, types, readOnlyMode, dropData ) {
    var subLocationContext = appCtxService.ctx.locationContext['ActiveWorkspace:SubLocation'];

    if( appCtxService.getCtx( 'isTC14_3OnwardsSupported' ) && dropData.targetObjects[0].modelType.typeHierarchyArray.indexOf( 'Qc0CharacteristicsGroup' ) > -1
        &&  subLocationContext === 'CharacteristicsLibrarySubLocation' ) {
        return VALID_TO_DROP_OBJECT;
    }
    return INVALID_TO_DROP_OBJECT;
}


/**
 * Paste copied objects on Reaction Plans table on inspection definition.
 * @param {Object} primaryObject Primary object in which objects will be pasted from the clipboard
 * @param {Array[Object]} copiedObjects Copied objects available in clipboard
 */
export let pasteReactionPlansToInspDefAndCharSpecMethod = function( primaryObject, copiedObjects ) {
    var resource = 'qualitycharacteristicsmanagerMessages';
    var localTextBundle = _localeSvc.getLoadedText( resource );
    var secondaryObjects = [];
    var invalidObjectsForPaste = [];

    // Separating Valid Quality Actions and Invalid objects which should not get pasted.
    copiedObjects.forEach( function( selectedObj ) {
        if( selectedObj.modelType.typeHierarchyArray.indexOf( 'Qam0QualityAction' ) > -1 ) {
            secondaryObjects.push( selectedObj );
        } else {
            invalidObjectsForPaste.push( selectedObj );
        }
    } );

    // If selected object is of type Aqc0QcElement i.e. run time object for inspection definition then
    // find it's persistent underlying object before pasting
    if( primaryObject && primaryObject.modelType.typeHierarchyArray.indexOf( 'Aqc0QcElement' ) > -1 ) {
        var underlyingObj = null;
        var underlyingObjProp = primaryObject.props.awb0UnderlyingObject;
        if( !_.isUndefined( underlyingObjProp ) ) {
            underlyingObj = clientDataModel.getObject( underlyingObjProp.dbValues[ 0 ] );
            primaryObject = underlyingObj;
        }
    }

    if( secondaryObjects.length > 0 ) {
        createRelationInspectionDefinition( primaryObject, secondaryObjects, invalidObjectsForPaste, localTextBundle );
    } else {
        showErrorMessageForQualityActionPasteFailure( invalidObjectsForPaste, localTextBundle, '' );
    }
};


/**
 * This function creates a relation a relation between Quality Action and Inspection Definition
 * @param {Object} primaryObject Primary object in which objects will be pasted from the clipboard
 * @param {Array[Object]} secondaryObjects Copied objects available in clipboard for paste
 * @param {Array[Object]} invalidObjectsForPaste Other than Quality action objects
 * @param {Object} localTextBundle Local text bundle to fetch error/info messages
 */
export let createRelationInspectionDefinition = function( primaryObject, secondaryObjects, invalidObjectsForPaste, localTextBundle ) {
    var deferred = AwPromiseService.instance.defer();
    var inputArray = [];
    var copiedObjectsTotalCount = secondaryObjects && invalidObjectsForPaste ? secondaryObjects.length + invalidObjectsForPaste.length : 0;

    // Creating input in loop for 'createRelations' SOA to create relation between Quality Actions and Inspection Definition
    secondaryObjects.forEach( function( selectedObj ) {
        var input = {
            clientId: 'AWClient',
            relationType: 'Qc0HasActions',
            primaryObject: {
                uid: primaryObject.uid,
                type: primaryObject.type
            },
            secondaryObject: {
                uid: selectedObj.uid,
                type: selectedObj.type
            }
        };
        inputArray.push( input );
    } );

    // Call createRelations SOA
    soaSvc.post( 'Core-2006-03-DataManagement', 'createRelations', { input: inputArray } ).then(
        function( response ) {
            deferred.resolve();

            // If only 1 allowed object is copied:
            if( invalidObjectsForPaste.length === 0 && secondaryObjects.length === 1 ) {
                showSuccessMsg( secondaryObjects[0], primaryObject, localTextBundle );
            }

            // If multiple allowed objects are copied:
            if( invalidObjectsForPaste.length === 0 && secondaryObjects.length > 1 ) {
                showMultipleAddSuccessMsg( primaryObject, secondaryObjects, localTextBundle );
            }

            // If few allowed and few not allowed objects are copied:
            if(  invalidObjectsForPaste && invalidObjectsForPaste.length > 0  &&  ( secondaryObjects && secondaryObjects.length > 0 ) ) {
                showPartialSuccessMsg( secondaryObjects.length, copiedObjectsTotalCount, localTextBundle );
                showErrorMessageForQualityActionPasteFailure( invalidObjectsForPaste, localTextBundle, '' );
            }

            refreshTargetObject( primaryObject );
        },
        function( error ) {
            var partialSuccessMessage = '';
            var successfullyPastedObjectCount = error && error.cause && error.cause.partialErrors ? secondaryObjects.length - error.cause.partialErrors.length : '';

            if( successfullyPastedObjectCount > 0 ) {
                showPartialSuccessMsg( successfullyPastedObjectCount, copiedObjectsTotalCount, localTextBundle );
            }
            var errMessage = processPartialErrorsForInspDefPaste( error );
            showErrorMessageForQualityActionPasteFailure( invalidObjectsForPaste, localTextBundle, errMessage );

            refreshTargetObject( primaryObject );
            throw error;
        } );
    return deferred.promise;
};


/**
 * Process the partial errors coming from server
 * @param {Object} error
 * @param {Array[Object]} secondaryObjects
 * @param {Object} localTextBundle
 */
export let processPartialErrorsForInspDefPaste = function( error ) {
    var partialErrors = error && error.cause && error.cause.partialErrors ? error.cause.partialErrors : [];
    var partialErrorMessage = '';

    partialErrors.forEach( function( err ) {
        if( err && err.errorValues && err.errorValues.length > 0 && err.errorValues[ 0 ] ) {
            // if error code matches with the required one, then replace that server error message text by custom message text, else show server message text as it is
            partialErrorMessage = partialErrorMessage + err.errorValues[ 0 ].message + '</br>';
        }
    } );
    return partialErrorMessage;
};


/**
 * Show partial success message for Quality Actions paste to Inspection Definition
 * @param {Number} successCount
 * @param {Number} totalCount
 * @param {Object} localTextBundle
 */
var showPartialSuccessMsg = function( successCount, totalCount, localTextBundle ) {
    var partialSuccessMsg = localTextBundle.Aqc0ReactionPlanPartialSuccess;
    partialSuccessMsg = partialSuccessMsg.replace( '{0}', successCount );
    partialSuccessMsg = partialSuccessMsg.replace( '{1}', totalCount );
    messagingSvc.showInfo( partialSuccessMsg );
};


/**
 * Show full success message for Quality Actions paste to Inspection Definition
 * @param {Number} successCount
 * @param {Number} totalCount
 * @param {Object} localTextBundle
 */
var showSuccessMsg = function( targetObject, sourceObject, localTextBundle ) {
    var reactionPlanAddSuccessMsg = localTextBundle.Aqc0ReactionPlanAddSuccessMessage;
    reactionPlanAddSuccessMsg = reactionPlanAddSuccessMsg.replace( '{0}', targetObject.props.object_name.dbValues[0] );
    reactionPlanAddSuccessMsg = reactionPlanAddSuccessMsg.replace( '{1}', sourceObject.props.object_name.dbValues[0] );
    messagingSvc.showInfo( reactionPlanAddSuccessMsg );
};


/**
 * Show Multiple Add success message for Quality Actions paste to Inspection Definition
 * @param {Number} successCount
 * @param {Number} totalCount
 * @param {Object} localTextBundle
 */
var showMultipleAddSuccessMsg = function( sourceObject, secondaryObjects, localTextBundle ) {
    var reactionPlanMultipleAddSuccessMsg = localTextBundle.Aqc0ReactionPlanMultipleAddSuccessMessage;
    reactionPlanMultipleAddSuccessMsg = reactionPlanMultipleAddSuccessMsg.replace( '{0}', secondaryObjects.length );
    reactionPlanMultipleAddSuccessMsg = reactionPlanMultipleAddSuccessMsg.replace( '{1}', sourceObject.props.object_name.dbValues[0] );
    messagingSvc.showInfo( reactionPlanMultipleAddSuccessMsg );
};


/**
 * Show error message in case of any error or failure in paste of Quality Actions to Inspection Definition
 * @param {Number} successCount
 * @param {Array[Object]} invalidObjectsForPaste
 * @param {Object} localTextBundle
 * @param {String} errorMsgFromServer
 */
var showErrorMessageForQualityActionPasteFailure = function( invalidObjectsForPaste, localTextBundle, errorMsgFromServer ) {
    var fullErrorMsg = '';
    var errorMsgTemplateForSingleObject = localTextBundle.Aqc0ReactionPlanInvalidObjectsMessage;
    var errorMsgForSingleObject = '';
    invalidObjectsForPaste.forEach( function( selectedObj ) {
        var objectString = selectedObj.props && selectedObj.props.object_string && selectedObj.props.object_string.uiValues && selectedObj.props.object_string.uiValues[ 0 ] ? selectedObj.props
            .object_string.uiValues[ 0 ] : '';
        errorMsgForSingleObject = errorMsgTemplateForSingleObject;
        errorMsgForSingleObject = errorMsgForSingleObject.replace( '{0}', objectString );
        errorMsgForSingleObject += '</br>';
        fullErrorMsg += errorMsgForSingleObject;
    } );
    fullErrorMsg = errorMsgFromServer ? fullErrorMsg + errorMsgFromServer : fullErrorMsg;
    messagingSvc.showError( fullErrorMsg );
};


/**
 * Refresh target object related view
 * @param {ModelObject} targetObject Parent to which the object was dropped
 */
var refreshTargetObject = function( targetObject ) {
    if( targetObject !== undefined ) {
        eventBus.publish( 'cdm.relatedModified', {
            relatedModified: [ targetObject ],
            refreshLocationFlag: false
        } );
    }
};

export default exports = {
    closeCompareView,
    createVersionSOACall,
    currentSelectionChanged,
    getAddCharSpecificationPanel,
    createInputForVarCharSpec,
    getCurrentType,
    getFailureMessage,
    getLOVList,
    getPopertyPolicyInCharLib,
    getSaveAsCharSpecificationPanel,
    getSaveAsInputForCharSpec,
    getSaveHandlerFCS,
    getSupportedTCVersion,
    getToleranceValue,
    getUnderlyingObject,
    getVersionInput,
    getVersionInputFEdit,
    getXrtViewModelForCharSpec,
    loadCharesticsData,
    loadObjects,
    loadSpecifications,
    openNewObject,
    performSaveEdit,
    processEditData,
    processPWASelection,
    setPropertiesForPaste,
    sortResults,
    throwValidationError,
    updateUpperLowerTol,
    validateUnitofMeasure,
    getSaveAsDeepCopyInput,
    dragStartActionForQc0MasterCharSpec,
    dragOverActionForQc0MasterCharSpec,
    pasteReactionPlansToInspDefAndCharSpecMethod,
    createRelationInspectionDefinition,
    showPartialSuccessMsg,
    showErrorMessageForQualityActionPasteFailure,
    refreshTargetObject,
    showSuccessMsg,
    showMultipleAddSuccessMsg,
    processPartialErrorsForInspDefPaste
};
