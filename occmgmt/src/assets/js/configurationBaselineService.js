// Copyright (c) 2022 Siemens

/**
 * @module js/configurationBaselineService
 */

import _ from 'lodash';
import addObjectUtils from 'js/addObjectUtils';
import appCtxSvc from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import AwStateService from 'js/awStateService';
import dataManagementService from 'soa/dataManagementService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import _occmgmtBackingObjectProviderService from 'js/occmgmtBackingObjectProviderService';
import policySvc from 'soa/kernel/propertyPolicyService';
import _uwPropSrv from 'js/uwPropertyService';
import occmgmtPropertyPolicyService from 'js/occmgmtPropertyPolicyService';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import occmgmtTreeTableDataService from 'js/occmgmtTreeTableDataService';
import occmgmtUpdatePwaDisplayService from 'js/occmgmtUpdatePwaDisplayService';
import aceExpandBelowService from 'js/aceExpandBelowService';
import backgroundWorkingCtxTimer from 'js/backgroundWorkingContextTimer';
import backgroundWorkingCtxSvc from 'js/backgroundWorkingContextService';
import localeService from 'js/localeService';
import cdmService from 'soa/kernel/clientDataModel';
import dateEffConfigration from 'js/dateEffectivityConfigurationService';


var exports = {};

/** Policy ID of required loaded objects */
let _policyId = null;

/**
  * Set the default properties for object_name.
  *
  * @param {*} createType The object type being created
  * @param {*} type the string
  * @param {*} xrtType Create/saveAs
  * @param {*} editHandler editHandleroccContext
  */
export let prePopulateNameField = ( createType, type, xrtType, editHandler, occContext ) => {
    let updatedProps = [];
    let editableProperties = addObjectUtils.getObjCreateEditableProperties( createType, xrtType, [ 'object_name' ], editHandler );

    if( occContext ) {
        var topNode = occContext.topElement.props.object_string.dbValues[0];


        // Object Name
        if( editableProperties.object_name ) {
            let object_name =  { ...editableProperties.object_name };
            object_name.dbValue = type.replace( '{0}', topNode );
            object_name.value = type.replace( '{0}', topNode );
            object_name.isRequired = true;
            object_name.valueUpdated = true;
            updatedProps.push( object_name );
        }

        addObjectUtils.assignInitialValues( updatedProps, createType, editHandler );
    }
};

/**
  * Function to get the backing object  and
  * assign to the data  membEr topLine.
  * @param {Object} data
  */
export let getBackingObject = function( modelObject, data ) {
    _getBomlineOfTopLine( modelObject ).then( function( response ) {
        data.dispatch( { path: 'data.topLine.dbValue', value:response } );
    } );
};

/**
  * Async function to get the backing object's for input viewModelObject's.
  * viewModelObject's should be of type Awb0Element.
  * @param {Object} viewModelObjects - of type Awb0Element
  * @return {Promise} A Promise that will be resolved with the requested backing object's when the data is available.
  *
  */
let _getBomlineOfTopLine = function( modelObject ) {
    let deferred = AwPromiseService.instance.defer();
    _occmgmtBackingObjectProviderService.getBackingObjects( [ modelObject ] ).then( function( response ) {
        return deferred.resolve( response[0].uid );
    } );
    return deferred.promise;
};

export let createInputForCreateConfigurationBaselineSOA = ( createType, topLine, editHandler ) => {
    var createInputMap = {};
    let data = {
        boName : createType
    };


    let stringProps = {};
    let boolProps = {};
    let tagProps = {};
    if( editHandler ) {
        let dataSource = editHandler.getDataSource();
        if( dataSource ) {
            let allEditableProperties = dataSource.getAllEditableProperties();
            _.forEach( allEditableProperties, function( vmProp ) {
                if ( vmProp && ( vmProp.isAutoAssignable || _uwPropSrv.isModified( vmProp ) ) ) {
                    if ( vmProp.type === 'BOOLEAN' ) {
                        boolProps[vmProp.propertyName] = vmProp.dbValue;
                    } else if ( vmProp.type === 'STRING' ) {
                        stringProps[vmProp.propertyName] =  vmProp.dbValue;
                    }
                }
            } );
        }

        //Create propertyNameValues for the customPanelProperty
        if( dataSource.getDeclViewModel() && dataSource.getDeclViewModel().customPanelInfo ) {
            _.forEach( dataSource.getDeclViewModel().customPanelInfo, function( customPanelVMData ) {
            // copy custom panel's properties
                var oriVMData = customPanelVMData._internal.origDeclViewModelJson.data;
                _.forEach( oriVMData, function( propVal, propName ) {
                    if ( _.has( customPanelVMData, propName ) ) {
                        var vmProp = customPanelVMData[propName];
                        tagProps[vmProp.propertyName] =
                        {
                            type:vmProp.type,
                            uid:vmProp.dbValue
                        };
                    }
                } );
            } );
        }
    }
    tagProps.fnd0InputBOMLine =
    {
        type:topLine.type,
        uid:topLine.dbValue
    };
    data.stringProps = stringProps;
    data.boolProps = boolProps;
    data.tagProps = tagProps;
    createInputMap.clientId = createType;
    createInputMap.data = data;

    return [ createInputMap ];
};

export let getPagedValidationRuleList = function( response, data ) {
    var validationRuleList = [];
    var result;
    let moreValuesExist = false;

    if( response.searchResults ) {
        result = response.searchResults;
        moreValuesExist = data.dataProviders.validationRuleForBaselineProvider.startIndex + response.totalLoaded < response.totalFound; // for pagination
    }

    var property = {
        propDisplayValue: '',
        propInternalValue: '',
        object: ''
    };
    if( result ) {
        for( var ii = 0; ii < result.length; ii++ ) {
            property = {
                propDisplayValue: result[ ii ].props.name.uiValues[ 0 ],
                propInternalValue: result[ ii ].uid,
                object: result[ ii ]
            };
            validationRuleList.push( property );
        }
    }
    return { validationRuleList, moreValuesExist };
};

export const initializeOccMgmtConfigurationBaselineView = ( data, subPanelContext ) => {
    let defer = AwPromiseService.instance.defer();
    let contextKey = subPanelContext._configurationBaselineLocation.contextKey;

    let stateParams = AwStateService.instance.params;
    _registerContext( subPanelContext._configurationBaselineLocation, stateParams );
    _registerAceActiveContext( contextKey );
    //ensure the required objects are loaded
    _policyId = registerPolicy();
    let uidsForLoadObject = [ stateParams.uid, stateParams.pci_uid, stateParams.t_uid ];
    dataManagementService.loadObjects( uidsForLoadObject ).then( function() {
        let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdmService.getObject( uidsForLoadObject[ 0 ] ), null );
        let taskTitle = '';
        let lastModifiedConfigurationBaseline = '';
        let productOpenedForConfigurationBaseline = '';
        let mainObject;
        if( vmo.type === 'Fnd0ConfigurationBaseline' ) {
            mainObject = cdmService.getObject( vmo.uid );
        }
        if( vmo.props && vmo.props.object_string ) {
            taskTitle = ' ' + vmo.props.object_string.uiValues[ 0 ] + ' ';
        }
        if( vmo.props && vmo.props.awp0CellProperties ) {
            let lastModifiedValue = vmo.props.awp0CellProperties.dbValues[3].split( '\\:' );
            lastModifiedConfigurationBaseline = lastModifiedValue[1];
        }
        if( vmo.props && vmo.props.fnd0Root ) {
            let productNameValue = vmo.props.fnd0Root.uiValues[0].split( ';' );
            productOpenedForConfigurationBaseline = ' ' + productNameValue[1] + ' ';
        }

        let headerTitle = ' |' +  taskTitle + ' | ' + productOpenedForConfigurationBaseline + ' ';

        let modelObjectsToOpen = [];
        modelObjectsToOpen.push( mainObject );
        appCtxSvc.updatePartialCtx( 'modelObjectsToOpen', modelObjectsToOpen );
        appCtxSvc.updatePartialCtx( 'occmgmtContext.lastModifiedConfigurationBaseline', lastModifiedConfigurationBaseline );
        appCtxSvc.updatePartialCtx( 'occmgmtContext.productOpenedForConfigurationBaseline', productOpenedForConfigurationBaseline );
        appCtxSvc.updatePartialCtx( 'occmgmtContext.taskTitle', headerTitle );
        defer.resolve( [ vmo ] );
    } );
    initializeOccMgmtServices( contextKey );
    return defer.promise;
};

let _registerContext = function( provider, stateParams ) {
    let requestPref = {
        savedSessionMode: 'ignore'
    };
    appCtxSvc.registerCtx( 'requestPref', requestPref );
    appCtxSvc.registerCtx( provider.contextKey, {
        currentState: {
            uid: stateParams.uid,
            pci_uid: stateParams.pci_uid,
            t_uid: stateParams.t_uid,
            t_bl_uid: stateParams.t_bl_uid
        },
        pwaSelectionModel: {},
        previousState: {},
        requestPref: requestPref,
        readOnlyFeatures: {},
        urlParams: provider.urlParams,
        expansionCriteria: {},
        isRowSelected: false,
        supportedFeatures: [],
        runInBackgroundValue: true,
        transientRequestPref: {},
        persistentRequestPref: {
            showExplodedLines: false
        }
    } );
};

let _registerAceActiveContext = function( contextKey ) {
    appCtxSvc.registerCtx( 'aceActiveContext', {
        key: contextKey,
        context: appCtxSvc.ctx[ contextKey ]
    } );
};

// Register the policy before SOA call
let registerPolicy = function() {
    return policySvc.register( {
        types: [ {
            name: 'Awb0ConditionalElement',
            properties: [ {
                name: 'awb0ArchetypeRevId'
            } ]
        } ]
    } );
};

export const initializeOccMgmtServices = ( contextKey ) => {
    occMgmtStateHandler.initializeOccMgmtStateHandler();
    occmgmtUpdatePwaDisplayService.initialize( contextKey );
    occmgmtTreeTableDataService.initialize();
    occmgmtPropertyPolicyService.registerPropertyPolicy();
    aceExpandBelowService.initialize();
    backgroundWorkingCtxTimer.initialize( contextKey );
    backgroundWorkingCtxSvc.initialize( contextKey );
};

export const initializeOccContext = ( data ) => {
    let stateParams = AwStateService.instance.params;
    let occContext = data.declViewModelJson.data.occContext.initialValues;
    occContext.currentState = {
        uid: stateParams.uid,
        pci_uid: stateParams.pci_uid,
        t_uid: stateParams.t_uid,
        t_bl_uid: stateParams.t_bl_uid
    };
    let configurationBaselineConfigParams = appCtxSvc.getCtx( 'configurationBaselineConfigParams' );
    if( configurationBaselineConfigParams ) {
        occContext.configContext = {
            r_uid: configurationBaselineConfigParams.currentRevRule,
            de: configurationBaselineConfigParams.effDate,
            ei_uid: configurationBaselineConfigParams.effEndItem,
            ue: configurationBaselineConfigParams.effUnitNo,
            eg_uids: configurationBaselineConfigParams.effectivityGroups,
            startDate: configurationBaselineConfigParams.startEffDates,
            fromUnit: configurationBaselineConfigParams.startEffUnits,
            endDate: configurationBaselineConfigParams.endEffDates,
            toUnit: configurationBaselineConfigParams.endEffUnits,
            var_uid: configurationBaselineConfigParams.variantRule,
            packSimilarElements: configurationBaselineConfigParams.packSimilarElements
        };
    }
    return {
        occContext: occContext ? occContext : data.atomicDataRef.occContext.getAtomicData()
    };
};


export const destroyOccmgmtConfigurationBaselineView = ( subPanelContext ) => {
    destroyOccMgmtServices( subPanelContext );
    appCtxSvc.unRegisterCtx( 'taskbarfullscreen' );
    appCtxSvc.unRegisterCtx( 'configurationBaselineConfigParams' );
    appCtxSvc.unRegisterCtx( 'aceActiveContext' );
    // Unregister the required objects policy
    if( _policyId ) {
        policySvc.unregister( _policyId );
    }
};

let destroyOccMgmtServices = ( subPanelContext ) => {
    let contextKey = subPanelContext.occContext.viewKey;
    occMgmtStateHandler.destroyOccMgmtStateHandler( contextKey );
    occmgmtUpdatePwaDisplayService.destroy( contextKey );
    occmgmtTreeTableDataService.destroy( contextKey );
    occmgmtPropertyPolicyService.unRegisterPropertyPolicy();
    aceExpandBelowService.destroy( contextKey );
    backgroundWorkingCtxTimer.reset();
    backgroundWorkingCtxSvc.reset( subPanelContext );
};

/**
  * This method update chip labels when props loaded event triggeres
  */
export let updateChipsOnPropsLoaded = function( subPanelContext ) {
    let occMgmtConfigurationBaselineResource = 'OccMgmtConfigBaselineConstants';
    let occMgmtConfigurationBaselineBundle = localeService.getLoadedText( occMgmtConfigurationBaselineResource );

    let currProductContextInfo = appCtxSvc.getCtx( 'occmgmtContext' ).productContextInfo;
    let occMgmtConfigurationBaselineChips = [];

    if( currProductContextInfo ) {
        if( subPanelContext.occContext.openedElement && subPanelContext.occContext.openedElement.props.fnd0State.dbValues[0] === 'Open' ) {
            let inWorkChipLabel = occMgmtConfigurationBaselineBundle.OccMgmtConfigurationBaselineInWorkChip;
            occMgmtConfigurationBaselineChips.push( getChip( inWorkChipLabel ) );
        }

        if( subPanelContext.occContext.openedElement && subPanelContext.occContext.openedElement.props.fnd0State.dbValues[0] === 'Closed' ) {
            let closeChipLabel = occMgmtConfigurationBaselineBundle.OccMgmtConfigurationBaselineCloseChip;
            occMgmtConfigurationBaselineChips.push( getChip( closeChipLabel ) );
        }

        if( currProductContextInfo && currProductContextInfo.props ) {
            //Revison Rule
            let revRule = currProductContextInfo.props.awb0CurrentRevRule;
            if( revRule.uiValues[ 0 ] ) {
                let revisionChipLabel = occMgmtConfigurationBaselineBundle.OccMgmtConfigurationBaselineRevisionChip;
                let currentRevRule = revRule.uiValues[ 0 ];
                revisionChipLabel = revisionChipLabel.replace( '{0}', currentRevRule );
                occMgmtConfigurationBaselineChips.push( getChip( revisionChipLabel ) );
            }
        }
    }

    return occMgmtConfigurationBaselineChips;
};

let getChip = ( value ) => {
    return {
        chipType: 'STATIC',
        labelDisplayName: value
    };
};

export let getTopLineMethod = function( modelObject ) {
    _getBomlineOfTopLineObject( modelObject ).then( function( response ) {
        var createInputData = {};
        createInputData = {
            uid: response.uid,
            type: response.type
        };
        let configurationBaselineContext = {
            topLineDetails: createInputData,
            unreleasedBomLines: null
        };
        appCtxSvc.updatePartialCtx( 'configurationBaselineContext', configurationBaselineContext );
        return {
            createInputData: createInputData
        };
    } );
};

let _getBomlineOfTopLineObject = function( modelObject ) {
    let deferred = AwPromiseService.instance.defer();
    _occmgmtBackingObjectProviderService.getBackingObjects( [ modelObject ] ).then( function( response ) {
        return deferred.resolve( response[0] );
    } );
    return deferred.promise;
};

export let configurationBaselineCreationSuccessMessage = function( createWorkingContext ) {
    let configBaselineUid = createWorkingContext.output[0].objects[0].uid;
    return createWorkingContext.ServiceData.modelObjects[configBaselineUid].props.object_string.dbValues[0];
};


export default exports = {
    prePopulateNameField,
    getBackingObject,
    createInputForCreateConfigurationBaselineSOA,
    getPagedValidationRuleList,
    initializeOccMgmtConfigurationBaselineView,
    initializeOccMgmtServices,
    initializeOccContext,
    destroyOccmgmtConfigurationBaselineView,
    updateChipsOnPropsLoaded,
    getTopLineMethod,
    configurationBaselineCreationSuccessMessage
};
