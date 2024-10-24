// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Crt1CreateStudyService
 */
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import dmSvc from 'soa/dataManagementService';
import soaSvc from 'soa/kernel/soaService';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import addObjectUtils from 'js/addObjectUtils';
import listBoxService from 'js/listBoxService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import appCtxSvc from 'js/appCtxService';

var exports = {};

/**
 * Init method to display create study panel according to which object selected.
 * This method will set the Create stylesheet to show according to selection
 *
 * @param {getStudySubtypesResponse} openedObject - Opened Object For Trends tab
 * @param {selectedScopeObj} selectedScopeObj - Selected scope object For Overview Tab
 * @param {i18n} i18n - locale strings
 */
export let initCreateStudyPanel = function( openedObject, selectedScopeObj, i18n, dataDisplayedType ) {
    var panelVisibility = false;
    var selType;
    var displayedType = _.clone( dataDisplayedType );
    var parentContract;

    if( selectedScopeObj && selectedScopeObj.uid ) {
        parentContract = cdm.getObject( selectedScopeObj.uid );
    } else {
        parentContract = cdm.getObject( openedObject.uid );
    }
    if( parentContract.modelType.typeHierarchyArray.indexOf( 'IAV0TestStudyRevision' ) > -1 ) {
        selType = {
            dbValue: 'IAV0TestRun'
        };
        displayedType.propertyDisplayName = i18n.Crt1AddTestEventPanelTitle;
        panelVisibility = true;
    } else if( parentContract.modelType.typeHierarchyArray.indexOf( 'Crt0StudyRevision' ) > -1 || parentContract.modelType.typeHierarchyArray.indexOf( 'Crt0SimStudyRevision' ) > -1 ) {
        selType = {
            dbValue: 'Crt0Run'
        };
        displayedType.propertyDisplayName = i18n.Crt1AddRunPanelTitle;
        panelVisibility = true;
    }
    return {
        displayedType: displayedType,
        parentContract: parentContract,
        panelVisibility: panelVisibility,
        selType: selType
    };
};

/**
 * This method will set population list according to selection
 *
 * @param {parentContract} parentContract - Opened Object For Trends tab & Selected object for Overview tab
 */
export let getPopulationList = function( parentContract ) {
    // populate the population list
    var populationInput = [];
    if( !parentContract ) {
        return;
    }
    populationInput.push( parentContract );
    // get the child studies
    var propNames = [];
    propNames.push( 'crt0ChildrenStudies' );
    var objects = [];
    objects.push( parentContract );
    dmSvc.getPropertiesUnchecked( objects, propNames ).then( function() {
        var childStudyUids = parentContract.props.crt0ChildrenStudies.dbValues;
        for( var i = 0; i < childStudyUids.length; i++ ) {
            var object = cdm.getObject( childStudyUids[ i ] );
            if( populationInput.indexOf( object ) === -1 ) {
                populationInput.push( object );
            }
        }
        eventBus.publish( 'CreateStudy.convertStudiesToList', populationInput );
    } );
};

export let convertStudiesToList = function( data ) {
    return listBoxService.createListModelObjects( data.eventData, 'props.object_name', false );
};
/**
 * Filter the study subtypes.
 * e.g. If study is selected and create study panel opened then show only Run and filter out other study subtypes
 *
 * @param {studySubtypeNames} getStudySubtypesResponseOutput - getStudySubtypesResponse output which has Study subtypes list
 * @param {studySubtypeNames} openedObject - Opened object
 * @param {studySubtypeNames} selectedScopeObj - Selected scope tree object
 *
 */
export let ensureStudyTypesLoadedJs = function( getStudySubtypesResponseOutput, openedObject, selectedScopeObj ) {
    var deferred = AwPromiseService.instance.defer();
    var returnedTypes = [];
    var displayableStudyTypes = getStudySubtypesResponseOutput;
    var modelType;

    var promise = soaSvc.ensureModelTypesLoaded( displayableStudyTypes );
    if( promise ) {
        promise.then( function() {
            var typeUids = [];
            var isTRSelected = false;
            var isStudySelected = false;
            var isTROpened = openedObject.modelType.typeHierarchyArray.indexOf( 'IAV0TestStudyRevision' ) > -1;
            var isStudyOpened = openedObject.modelType.typeHierarchyArray.indexOf( 'Crt0StudyRevision' ) > -1;
            var isVROpened = openedObject.modelType.typeHierarchyArray.indexOf( 'Crt0VldnContractRevision' ) > -1;
            if( selectedScopeObj ) {
                isTRSelected = selectedScopeObj.modelType.typeHierarchyArray.indexOf( 'IAV0TestStudyRevision' ) > -1;
                isStudySelected = selectedScopeObj.modelType.typeHierarchyArray.indexOf( 'Crt0StudyRevision' ) > -1;
            }
            for( var i = 0; i < displayableStudyTypes.length; i++ ) {
                if( isVROpened && !isStudyOpened  &&  !isStudySelected  ) {
                    modelType = cmm.getType( displayableStudyTypes[ i ] );

                    returnedTypes.push( modelType );
                    typeUids.push( modelType.uid );
                } else if( !( isTROpened || isTRSelected ) && ( isStudyOpened || isStudySelected ) ) {
                    modelType = cmm.getType( displayableStudyTypes[ i ] );
                    if( modelType.typeHierarchyArray.indexOf( 'Crt0Run' ) > -1 && modelType.typeHierarchyArray.indexOf( 'IAV0TestRun' ) <= -1 ) {
                        returnedTypes.push( modelType );
                        typeUids.push( modelType.uid );
                    }
                } else if( isTROpened || isTRSelected ) {
                    modelType = cmm.getType( displayableStudyTypes[ i ] );
                    if( modelType.typeHierarchyArray.indexOf( 'IAV0TestRun' ) > -1 ) {
                        returnedTypes.push( modelType );
                        typeUids.push( modelType.uid );
                    }
                }
            }
            //ensure the ImanType objects are loaded
            var policyId = propPolicySvc.register( {
                types: [ {
                    name: 'ImanType',
                    properties: [ {
                        name: 'parent_types'
                    }, {
                        name: 'type_name'
                    } ]
                } ]
            } );

            dmSvc.loadObjects( typeUids ).then( function() {
                var returnedData = {
                    searchResults: returnedTypes,
                    totalFound: returnedTypes.length
                };

                propPolicySvc.unregister( policyId );

                deferred.resolve( returnedData );
            } );
        } );
    }

    return deferred.promise;
};

/**
 * Clear selected type when user clicks on type link on create form
 */
export let clearSelectedTypeJs = function() {
    var panelVisibility;
    panelVisibility = false;
    return {
        panelVisibility: panelVisibility
    };
};

/**
 * When user select type from type selection panel we need to navigate to create form.
 *
 * @param {Object} selectedStudyType - Selected study subtype
 */
export let handleTypeSelectionJs = function( data ) {
    var selectedStudyType = data.dataProviders.getStudyTypes.selectedObjects;
    var displayedType = _.clone( data.displayedType );
    var selType = _.clone( data.selType );
    var panelVisibility;
    if( selectedStudyType && selectedStudyType.length > 0 ) {
        selType.dbValue = selectedStudyType[ 0 ].props.type_name.dbValue;
        displayedType.propertyDisplayName = selectedStudyType[ 0 ].props.object_string.dbValue;
        panelVisibility = true;
    }

    return {
        displayedType: displayedType,
        selType: selType,
        panelVisibility: panelVisibility
    };
};

/**
 * Initializes the inputs for the create SOA
 *
 * @param {data} data - data
 * @param {data} openedObject - Opened object
 * @param {data} editHandler - The editHandler object
 */
export let createStudyInit = function( data, openedObject, editHandler ) {
    var createInputs = addObjectUtils.getCreateInput( data, null, data.selType.dbValue, editHandler );
    if( createInputs[ 0 ].createData.propertyNameValues.object_desc === undefined ) {
        createInputs[ 0 ].createData.propertyNameValues.object_desc = [ '' ];
    }
    var crt0ParentVldnContract = data.parentContract.uid;
    var crt0Population;
    var popValueToCompare;
    var popValue;
    var revisionType;
    var populationObj;
    if( data && data.populationValues && appCtxSvc.ctx.panelContext && appCtxSvc.ctx.panelContext.selObj ) {
        popValue = data.populationValues.dbValue;
    } else if( data && data.populationValuesForTrends && !appCtxSvc.ctx.panelContext.selObj ) {
        popValue = data.populationValuesForTrends.dbValue;
    }
    if( popValue && popValue.uid ) {
        populationObj = popValue;
    } else if( popValue ) {
        popValueToCompare = popValue;
        for( var i = 0; i < data.population.length; i++ ) {
            if( data.population[ i ].propDisplayValue &&  popValueToCompare === data.population[ i ].propDisplayValue  ) {
                populationObj = data.population[ i ].propInternalValue;
            }
        }
    }
    if( populationObj && populationObj.uid ) {
        crt0Population = populationObj.uid;
    } else {
        crt0Population = '';
    }
    revisionType = data.selType.dbValue + 'Revision';
    var selType = data.selType;
    if( openedObject.modelType.typeHierarchyArray.indexOf( 'Crt0StudyRevision' ) > -1 &&
        openedObject.modelType.typeHierarchyArray.indexOf( 'IAV0TestStudyRevision' ) <= -1 ) {
        revisionType = selType.dbValue + 'Revision';
    }
    if( openedObject.modelType.typeHierarchyArray.indexOf( 'IAV0TestStudyRevision' ) > -1 ) {
        revisionType = selType.dbValue + 'Revision';
    }
    var createInputsForSubtypes = {
        crt0ParentVldnContract: [ crt0ParentVldnContract ],
        crt0Population: [ crt0Population ]
    };
    if( createInputs[ 0 ] && createInputs[ 0 ].createData && createInputs[ 0 ].createData.compoundCreateInput && createInputs[ 0 ].createData.compoundCreateInput.revision &&
        createInputs[ 0 ].createData.compoundCreateInput.revision.length > 0 ) {
        var newProperty = createInputs[ 0 ].createData.compoundCreateInput.revision[ 0 ].propertyNameValues;
        for( let entry of Object.entries( newProperty ) ) {
            createInputsForSubtypes[ entry[ 0 ] ] = entry[ 1 ];
        }
    } else {
        newProperty = {};
    }
    return {
        revisionType: revisionType,
        createInputs: createInputs[ 0 ].createData.propertyNameValues,
        createInputsForSubtypes: createInputsForSubtypes
    };
};

/**
 * This method is used to process the response
 * @param {Object} response response to be processed
 * @return {Object} all the nameTypes
 */
export let processSoaResponseForBOTypes = function( response ) {
    var typeNames = [];
    if( response.output ) {
        for( var ii = 0; ii < response.output.length; ii++ ) {
            var displayableBOTypeNames = response.output[ ii ].displayableBOTypeNames;
            for( var jj = 0; jj < displayableBOTypeNames.length; jj++ ) {
                typeNames.push( displayableBOTypeNames[ jj ].boName );
            }
        }
    }
    return typeNames;
};

export let refreshPWATreeTable = function( data, subPanelContext ) {
    var newVrSublocationState = { ...subPanelContext.vrSublocationState.value };
    newVrSublocationState.isinStudyProgress = true;
    if( data.createStudyData && data.createStudyData.partialErrors === undefined || data.removeStudySoaResponse && data.removeStudySoaResponse.partialErrors === undefined ) {
        eventBus.publish( 'gridView.plTable.reload' );
    }
    subPanelContext.vrSublocationState.update && subPanelContext.vrSublocationState.update( newVrSublocationState );
};

export default exports = {
    initCreateStudyPanel,
    getPopulationList,
    ensureStudyTypesLoadedJs,
    clearSelectedTypeJs,
    handleTypeSelectionJs,
    createStudyInit,
    processSoaResponseForBOTypes,
    convertStudiesToList,
    refreshPWATreeTable
};
