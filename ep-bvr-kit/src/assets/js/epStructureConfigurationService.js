// Copyright (c) 2022 Siemens

/**
 * Service for ep structure configuration
 *
 * @module js/epStructureConfigurationService
 */

import appCtxService from 'js/appCtxService';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import eventBus from 'js/eventBus';
import AwStateService from 'js/awStateService';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import cdmSvc from 'soa/kernel/clientDataModel';
import epLoadInputHelper from 'js/epLoadInputHelper';
import epLoadService from 'js/epLoadService';
import mfeVMOLifeCycleSvc from 'js/services/mfeViewModelObjectLifeCycleService';
import { constants as epSaveConstants } from 'js/epSaveConstants';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import dateTimeService from 'js/dateTimeService';
import preferenceService from 'soa/preferenceService';
import mfeViewModelUtils from 'js/mfeViewModelUtils';
import endItemUnitEffectivityService from 'js/endItemUnitEffectivityConfigurationService';
import viewModelObjectService from 'js/viewModelObjectService';
import epContextService from 'js/epContextService';


const EP_ACTIVE_STRUCTURE_CONFIG = 'epActiveStructureConfig';
const IS_NOT_AFTER_SET_CONFIG_BALANCING = 'ep.isNotAfterSetConfigBalancing';
/**
 * Get context info from active context
 *
 * @param {Object} epActiveStructureConfig config object of config panel
 * @param {Object} panelContextData panelContextData
 * @param {Boolean} skipReloadOnConfigParamChange should automatic page update/ reload occur after updating config params
 */
function updateConfigurationFilterPanelData( epActiveStructureConfig, panelContextData, skipReloadOnConfigParamChange = true ) {
    let pciObject = epActiveStructureConfig.productContextInfo;
    let supportedFeatures = null;
    let panelData = {
        viewKey: epActiveStructureConfig.contextKey,
        productContextInfo: pciObject,
        elementToPCIMapCount: epActiveStructureConfig.elementToPCIMapCount,
        skipReloadOnConfigParamChange: skipReloadOnConfigParamChange
    };
    if( epActiveStructureConfig.supportedFeatures ) {
        supportedFeatures = epActiveStructureConfig.supportedFeatures;
    } else if( pciObject && pciObject.props ) {
        supportedFeatures = occMgmtStateHandler.getSupportedFeaturesFromPCI( pciObject );
    }

    if( !panelContextData.getValue().topElement && epActiveStructureConfig.topElement ) {
        panelData.topElement = epActiveStructureConfig.topElement;
    }
    panelData.supportedFeatures = supportedFeatures;
    mfeViewModelUtils.mergeValueInAtomicData( panelContextData, panelData );
}

/**
 * Init Occurrence Management to populate Configuration panel when opened, subscribe to events
 */
function initialize() {
    occMgmtStateHandler.initializeOccMgmtStateHandler();
}

/**
 * Put the structure context in ctx
 *
 * @param {String} pciUid the pciUid to put its structure context in ctx
 * @param {String} ctxStructureContextName the structure context name to put in ctx
 *                                         i.e. 'processStructureContext'/ 'mbomStructureContext'
 * @param {String} structureKey the ctx key name of the current structure which is configured
 * @param {String} configFilterPanelTitle the configuration panel title
 * @param { String } configFlagContextName key name for epTaskPageContext, to get excluded flags details
 * @param { String } scopeKey the ctx key name of the current scope of the structure which is configured
 * @param {String} topElement the top element that is being configured
 * @return {Boolean} true in context set otherwise false
 */
function setCtxStructureContext( pciUid, ctxStructureContextName, structureKey, configFilterPanelTitle, configFlagContextName, scopeKey, topElement ) {
    if( pciUid ) {
        const pciModelObject = cdmSvc.getObject( pciUid );
        const epTaskPageContext = appCtxService.getCtx( 'epTaskPageContext' );
        const configFlagContext = epTaskPageContext[ configFlagContextName ];

        let contextOfStructure = appCtxService.getCtx( ctxStructureContextName );
        let topElementToSetInCtx = contextOfStructure ? contextOfStructure.topElement : null;
        if( !topElementToSetInCtx ) {
            topElementToSetInCtx = topElement;
        }
        const ctxStructureContext = Object.assign( {},
            appCtxService.getCtx( ctxStructureContextName ), {
                productContextInfo: pciModelObject,
                contextKey:ctxStructureContextName,
                structureKey: structureKey,
                configFilterPanelTitle: configFilterPanelTitle,
                scopeKey: scopeKey,
                excludedFlagsState: {
                    epExcludedByEffectivity: configFlagContext.show_unconfigured_effectivity && configFlagContext.show_unconfigured_effectivity[ 0 ] === 'true',
                    epShowExcludedAssignments: configFlagContext.show_unconfigured_assignment && configFlagContext.show_unconfigured_assignment[ 0 ] === 'true',
                    epShowExcludedByVariant: configFlagContext.show_unconfigured_variants && configFlagContext.show_unconfigured_variants[ 0 ] === 'true'
                },
                topElement: topElementToSetInCtx
            }
        );
        appCtxService.registerCtx( EP_ACTIVE_STRUCTURE_CONFIG, ctxStructureContext );
        appCtxService.updateCtx( 'aceActiveContext', { key: ctxStructureContextName, context: {}  } );

        eventBus.publish( 'occDataLoadedEvent', { contextKey: ctxStructureContextName } );
        return true;
    }

    return false;
}

/**
 * activate structure context as ACE Active Context
 *
 * @param {String} pciUid the uid of  PCI  i.e. 'processPCI', ebomPCI 'mbomPCI'etc
 * @param {String} contextKey the StructureContext name to activate
 *                            i.e. 'processStructureContext'/ 'mbomStructureContext'
 * @param {String} structureKey the ctx key name of the current structure which is configured
 * @param {String} configFilterPanelTitle the configuration panel title
 * @param { String } configFlagContextName key name for epTaskPageContext, to get excluded flags details
 * @param { String } scopeKey the ctx key name of the current scope of the structure which is configured,
 * can be sub process of process structure, can be empty if not relevant
 * @param {String} topElement the top element that is being configured
 * @param {Array} excludeFeatures list of features to be excluded from awb0AvailableFeatures in the response for e.g 'Awb0VariantFeature'
 *
 * @returns {Object} loaded runtime configuration
 */
function activateStructureContext( pciUid, contextKey, structureKey, configFilterPanelTitle, configFlagContextName, scopeKey, topElement, excludeFeatures ) {
    const structure = appCtxService.getCtx( structureKey );
    if( pciUid && structure ) {
        const loadedObjectUid = structure.uid;
        let loadParamsForExcludeFeatures = null;
        if( excludeFeatures ) {
            loadParamsForExcludeFeatures = getLoadParamsForExcludeFeatures( excludeFeatures );
        }
        const loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( [ 'RuntimeConfiguration' ], loadedObjectUid, null, null, loadParamsForExcludeFeatures );
        return epLoadService.loadObject( loadTypeInputs, false ).then(
            function() {
                return setCtxStructureContext( pciUid, contextKey, structureKey, configFilterPanelTitle, configFlagContextName, scopeKey, topElement );
            } );
    }

    return Promise.resolve( false );
}

/**
 * Creates additionalLoadParams input to exclude features
 * @param {Array} excludeFeatures array of features
 * @returns{Object} additionalLoadParams soa input
 */
function getLoadParamsForExcludeFeatures( excludeFeatures ) {
    return [ {
        tagName: 'awb0AvailableFeatures',
        attributeName: 'excludeFeatures',
        attributeValue: excludeFeatures
    }
    ];
}


/**
 * Get the related objects to pass as input to save soa call
 *
 * @param {Object} loadedStructures the loaded configuration structure
 *
 * @returns {ObjectArray} relatedObjects
 */
function getRelatedObjects( loadedStructures ) {
    const relatedObjects = [];
    loadedStructures.forEach( ( structure )=>{
        const relModelObject = {
            uid: structure.uid,
            type: structure.type
        };
        relatedObjects.push( relModelObject );
    } );
    const structureContext = appCtxService.getCtx( EP_ACTIVE_STRUCTURE_CONFIG );
    relatedObjects.push( structureContext.productContextInfo );
    return relatedObjects;
}

/**
 *
 * @param {*} configData configData
 */
function clearConfigData( configData ) {
    if( configData ) {
        configData.update( { isBaseViewVisible: true } );
    }
}

/**
 *
 * @param {Object} configData  configData
 * @param {Object} updatedValues updatedValues
 * @param {String} modifiedProp updatedValues
 */
function updateConfigData( configData, updatedValues, modifiedProp ) {
    if( configData && updatedValues && modifiedProp === 'eg_uids' ) {
        mfeViewModelUtils.mergeValueInAtomicData( configData, updatedValues );
    }
}
/**
 * Get the change in configuration panel to pass as input to save soa call
 *
 * @param {Object} configData the changed configuration data
 * @param {Object} occContext occContext
 * @returns {Object} configChange
 */
function getConfigurationToSave( configData, occContext ) {
    const configChange = {};

    if( configData.effectivityDate ) {
        configChange.effDate = dateTimeService.formatUTC( configData.effectivityDate );
    }
    if( configData.endItemUid ) {
        configChange.endItem = configData.endItemUid;
    }
    if( configData.effectiveUnit ) {
        configChange.unitNo = [ configData.effectiveUnit.toString() ];
        if( !configData.endItemUid ) {
            setDefaultEndItem( configChange, occContext );
        }
    }
    if( configData.revisionRule ) {
        configChange.revisionRule = configData.revisionRule;
    }
    if( configData.occurrenceScheme ) {
        configChange.occurrenceScheme = configData.occurrenceScheme;
    }
    if( configData.effectivityGroups ) {
        configChange.effGroup = configData.effectivityGroups;
        configChange.endItemUid =  'AAAAAAAAAAAAAA';
    }
    if( configData.variantRule ) {
        configChange.variantRule = configData.variantRule;
    } else if( configData.variantRule === null ) {
        configChange.variantRule = [ '' ];
    }
    if( configData.variantRuleOwningRev ) {
        configChange.variantItemUid = [ configData.variantRuleOwningRev ];
    }
    if( configData.closureRule ) {
        configChange.closureRule = [ configData.closureRule ];
    }
    if( configData.showExcludedByEffectivity || configData.showExcludedByEffectivity === false ) {
        configChange.toggleShowUnconfigEff = configData.showExcludedByEffectivity ? 'true' : 'false';
    }
    if( configData.showExcludedByVariant || configData.showExcludedByVariant === false ) {
        configChange.toggleShowVariants = configData.showExcludedByVariant ? 'true' : 'false';
    }
    if( configData.showExcludedAssignments || configData.showExcludedAssignments === false ) {
        configChange.toggleShowAssignedOcc = configData.showExcludedAssignments ? 'true' : 'false';
    }
    if( configData.saveConfigurationToWP || configData.saveConfigurationToWP === false ) {
        configChange.toggleSaveConfigToCC = configData.saveConfigurationToWP ? 'true' : 'false';
    }

    return configChange;
}

/**
 * Set end item from the context if it wasn't set by user in  the dialog
 * @param {Object} configChange the changed configuration data
 */
function setDefaultEndItem( configChange, occContext ) {
    //get end item saved in context
    var endItem = endItemUnitEffectivityService.getEndItemFromProductContextInfo( occContext );
    if( endItem ) {
        var endItemUID = endItem.uid;
        if( !endItemUID && endItem.dbValues ) {
            endItemUID = endItem.dbValues[ 0 ];
        }
        configChange.endItem = endItemUID;
    }
}

/**
 * returns true if any setting is defined in the config data, otherwise returns false.
 *
 * @param {*} configData config data as selected by the user
 * @returns {boolean} returns true if any setting is defined in the config data, otherwise returns false.
 */
function isDirty( configData ) {
    let updatedValues = configData.getValue();
    let isConfigChanged = updatedValues && ( updatedValues.endItemUid || updatedValues.effectiveUnit || updatedValues.effectivityDate || updatedValues.revisionRule || updatedValues.occurrenceScheme ||
        updatedValues.effectivityGroups || ( updatedValues.variantRule || updatedValues.variantRule === null ) || updatedValues.variantRuleOwningRev || updatedValues.closureRule ||
        ( updatedValues.showExcludedByVariant || updatedValues.showExcludedByVariant === false ) ||
        ( updatedValues.showExcludedByEffectivity || updatedValues.showExcludedByEffectivity === false ) ||
        ( updatedValues.showExcludedAssignments || updatedValues.showExcludedAssignments === false ) ||
        ( updatedValues.saveConfigurationToWP || updatedValues.saveConfigurationToWP === false ) );

    return Boolean( isConfigChanged );
}

/**
 * Call epSaveService to save all the changes
 *
 * @param {Object} configData the changed configuration data
 *@param {Object} occContext occContext
 * @returns {Object} saveResponse
 */
function saveChanges( configData, occContext ) {
    if( isDirty( configData ) ) {
        const epStructureContextConfig = appCtxService.getCtx( EP_ACTIVE_STRUCTURE_CONFIG );
        const loadedStructure = appCtxService.getCtx( epStructureContextConfig.scopeKey ? epStructureContextConfig.scopeKey : epStructureContextConfig.structureKey );
        const targetAsm = {
            id: [ loadedStructure.uid ]
        };

        const saveWriter = saveInputWriterService.get();
        let upadtedCongigChanges = getConfigurationToSave( configData, occContext );
        saveWriter.addConfigurationChangeEntry( targetAsm, upadtedCongigChanges );
        return epSaveService.saveChanges( saveWriter, false, getRelatedObjects( [ loadedStructure ] ), true ).then( function( appliedConfig ) {
            let pciType = getAppliedConfigType( appliedConfig );

            let updatedConfigFlag = {
                toggleShowUnconfigEff: upadtedCongigChanges.toggleShowUnconfigEff,
                toggleShowVariants: upadtedCongigChanges.toggleShowVariants,
                showExcludedAssignments: upadtedCongigChanges.showExcludedAssignments,
                toggleSaveConfigToCC: upadtedCongigChanges.toggleSaveConfigToCC
            };
            Object.keys( updatedConfigFlag ).forEach( key => updatedConfigFlag[ key ] === undefined && delete updatedConfigFlag[ key ] );
            return { appliedConfig: appliedConfig, appliedConfigType: pciType, updatedConfigFlag: updatedConfigFlag };
        } );
    }
    return Promise.resolve( null );
}

/**
 *
 * @param {Object} appliedConfig  appliedConfig
 * @returns {String} applied configType;
 */
function getAppliedConfigType( appliedConfig ) {
    let appliedConfigType;
    appliedConfig.saveEvents.forEach( ( saveEvent ) => {
        if( saveEvent.eventType === epSaveConstants.CREATE_EVENT ) {
            // The mbom & product might have the same PCI object
            saveEvent.eventData.forEach( ( param ) => {
                if( param === 'processPCI' || param === 'productPCI' || param === 'ebomPCI' || param === 'mbomPCI' ||
                    param === 'productionProgramPCI' || param === 'plantPCI' || param === 'functionalPlanPCI' ) {
                    appliedConfigType = param;
                    return true;
                }
            } );
        }
    } );

    return appliedConfigType;
}
/**
 * Call handleResponseAndRedirect in case an error and there is no response (the root was configure out)
 * Then move to another page either bop breakdown planing or manage page
 *
 * @param {Object} saveResponse The response we got from the server
 * @param { Boolean } shouldUpdatePciParam whether to update PCI param in the uRL or not, like on manage work package we should not add them.
 *
 */
function handleResponseAndRedirect( saveResponse, shouldUpdatePciParam ) {
    let toParams = {};
    // There are save events and there are errors or at least one
    if( saveResponse.saveEvents && saveResponse.saveEvents.length > 0 ) {
        let url = handleSaveEvents( saveResponse, shouldUpdatePciParam );
        let searchParams = url.searchParams;
        searchParams.forEach( ( value, key ) => {
            toParams[ key ] = value;
        } );
    } else {
        let loc = window.location.href;
        loc = loc.replace( '#', '/' );
        loc = loc.replaceAll( '~2F', '/' );

        let url = new URL( loc );

        // Get the url parameters
        let searchParams = url.searchParams;
        searchParams.forEach( ( value, key ) => {
            toParams[ key ] = value;
        } );
    }

    const options = {
        inherit: true,
        reload: true
    };

    // Check the preference if there is highLevelPlanning
    preferenceService.getLogicalValue( 'EP_PlanningForSmallProduct' ).then(
        function( result ) {
            // if there is a preference and TRUE it means the task is invisible .
            // Therefor we will go back to the manage page
            if( result !== null && result.length > 0 && result.toUpperCase() === 'TRUE' ) {
                let ccuid = appCtxService.getCtx( 'ep.loadedCCObject.uid' );
                toParams.uid = ccuid;
                AwStateService.instance.go( 'manageWorkPackageNew', toParams, options );
            } else {
                // The preference is false or does not exists go back to breakdown page
                toParams.uid = appCtxService.getCtx( 'epTaskPageContext.processStructure.uid' );
                AwStateService.instance.go( 'highLevelPlanning', toParams, options );
            }
        } );
}

/**
 * Handle save events
 *
 * @param {Object} saveResponse the save response
 * @param { Boolean } shouldUpdatePciParam whether to update PCI param in the uRL or not, like on manage work package we should not add them.
 *
 * @returns {Object} url
 */
function handleSaveEvents( saveResponse, shouldUpdatePciParam ) {
    let loc = window.location.href;
    loc = loc.replace( '#', '/' );
    loc = loc.replaceAll( '~2F', '/' );

    let url = new URL( loc );

    // Get the url parameters
    let searchParams = url.searchParams;
    if( AwStateService.instance.current.name !== 'manageWorkPackageNew' ) {
        const epTaskPageContext = appCtxService.getCtx( 'epTaskPageContext' );
        if( !loc.includes( 'processPCI' ) && epTaskPageContext.processPCI ) {
            searchParams.set( 'processPCI', epTaskPageContext.processPCI.uid );
        }
        if( !loc.includes( 'productPCI' ) && epTaskPageContext.productPCI ) {
            searchParams.set( 'productPCI', epTaskPageContext.productPCI.uid );
        }
        if( !loc.includes( 'ebomPCI' ) && epTaskPageContext.ebomPCI ) {
            searchParams.set( 'ebomPCI', epTaskPageContext.ebomPCI.uid );
        }
        if( !loc.includes( 'mbomPCI' ) && epTaskPageContext.mbomPCI ) {
            searchParams.set( 'mbomPCI', epTaskPageContext.mbomPCI.uid );
        }
        if( !loc.includes( 'plantPCI' ) && epTaskPageContext.plantPCI ) {
            searchParams.set( 'plantPCI', epTaskPageContext.plantPCI.uid );
        }
        if( !loc.includes( 'functionalPlanPCI' ) && epTaskPageContext.functionalPlanPCI ) {
            searchParams.set( 'functionalPlanPCI', epTaskPageContext.functionalPlanPCI.uid );
        }
    }
    if( shouldUpdatePciParam ) {
        const subLocationName  = appCtxService.getCtx( 'sublocation' ).nameToken;
        saveResponse.saveEvents.forEach( ( saveEvent ) => {
            if( saveEvent.eventType === epSaveConstants.CREATE_EVENT ) {
                // The mbom & product might have the same PCI object
                saveEvent.eventData.forEach( ( param ) => {
                    if( param === 'processPCI' || param === 'productPCI' || param === 'ebomPCI' || param === 'mbomPCI' ||
                        param === 'productionProgramPCI' || param === 'plantPCI' || param === 'functionalPlanPCI' ) {
                        // Update the url param value
                        searchParams.set( param, saveEvent.eventObjectUid );
                    }
                    // this function will get called in case of reset configuration, on EBOM-MBOM Alignmnet page they use CC id as a scope and not the process
                    else if( param === 'processStructure' && subLocationName !== 'multiBOMManager:ebomContextSublocation' && subLocationName !== 'multiBOMManager:mbomContextSublocation' && subLocationName !== 'functionalPlan'
                    ||  param === 'functionalPlan' && subLocationName === 'functionalPlan'  ) {
                        searchParams.set( 'uid', saveEvent.eventObjectUid );
                        const loadedVMO = mfeVMOLifeCycleSvc.createViewModelObjectFromUid( saveEvent.eventObjectUid );
                        epContextService.setPageContext( 'loadedObject', loadedVMO );
                    }
                } );
            }
        } );
    }
    url.search = searchParams.toString();
    return url;
}

/**
 * Process the configuration change save response
 *
 * @param {Object} saveResponse the save response
 * @param { Boolean } shouldUpdatePciParam whether to update PCI param in the uRL or not, like on manage work package we should not add them.
 */
function handleResponse( saveResponse, shouldUpdatePciParam ) {
    appCtxService.registerCtx( 'forceReload', true );
    if( saveResponse.saveEvents && saveResponse.saveEvents.length > 0 && ( !saveResponse.ServiceData || !saveResponse.ServiceData.partialErrors ) ) {
        handleSaveAndRedirect( saveResponse, shouldUpdatePciParam );
    } else {
        // There is no save response either the root configure out or the current scope in work instruction, assembly planning.
        // Therefore change the location from the application to bopbreakdown
        handleResponseAndRedirect( saveResponse, shouldUpdatePciParam );
    }
}

/**
 * handleSaveAndRedirect taking care of the response and save and then redirect to the same page.
 * The reason for redirect is for refresh and load the data with the new configuration.
 * We are sending the new parameters for update in the URL
 *
 * @param {Object} saveResponse the save response
 * @param { Boolean } shouldUpdatePciParam whether to update PCI param in the uRL or not, like on manage work package we should not add them.
 */
function handleSaveAndRedirect( saveResponse, shouldUpdatePciParam ) {
    let url = handleSaveEvents( saveResponse, shouldUpdatePciParam );
    let searchParams = url.searchParams;
    let toParams = {};
    searchParams.forEach( ( value, key ) => {
        toParams[ key ] = value;
    } );

    const options = {
        inherit: true,
        reload: true
    };
    const subLocationName = appCtxService.getCtx( 'sublocation' ).nameToken;
    if( subLocationName === 'lineBalancing' ) {
        appCtxService.updatePartialCtx( IS_NOT_AFTER_SET_CONFIG_BALANCING, true );
    }
    AwStateService.instance.go(  AwStateService.instance.current.name, toParams, options );
}

/**
 * Call epSaveService to save all the changes configuration flags
 *
 * @param {Object} topObject the top object
 * @param {String} ConfigurationFlag config flag name
 * @param { String } isManageWorkPackagePage to decide whether to update PCI param in the URL or not, on manage work package we should not add them.
 *
 * @returns {Object} saveResponse
 */
function saveConfigurationFlags( topObject, ConfigurationFlag, isManageWorkPackagePage ) {
    const saveWriter = saveInputWriterService.get();
    let configFlag = {
        [ `${ConfigurationFlag}` ]: [ 'true' ]
    };

    let shouldUpdatePciParam = true;
    if( isManageWorkPackagePage && isManageWorkPackagePage === 'true' ) {
        shouldUpdatePciParam = false;
    }
    const stateParams = AwStateService.instance.params;
    if( stateParams && stateParams.uid && cdmSvc.getObject( stateParams.uid ).modelType.typeHierarchyArray.includes( epBvrConstants.IMAN_ITEM_BOP_LINE ) ) {
        configFlag.currentScope = stateParams.uid;
    }

    saveWriter.addConfigurationChangeEntry( { id: topObject.uid }, configFlag );
    return epSaveService.saveChanges( saveWriter, false, [ topObject ], true ).then( function( saveResponse ) {
        if( !saveResponse.ServiceData || !saveResponse.ServiceData.partialErrors ) {
            appCtxService.registerCtx( 'forceReload', true );
            handleSaveAndRedirect( saveResponse, shouldUpdatePciParam );
        }
        return Promise.resolve( saveResponse );
    } );
}

/**
 * Get the configuration filter panel title
 *
 * @returns {String} title
 */
function getConfigFilterPanelTitle() {
    const epStructureContextConfig = appCtxService.getCtx( EP_ACTIVE_STRUCTURE_CONFIG );
    return epStructureContextConfig.configFilterPanelTitle;
}

/**
 * Set excluded flags status based on existing configuration. This method is get called while loading the configuration panel.
 *
 * @returns {Object} excluded flags status true/false
 */
function setExcludedFlagsStatus() {
    const epStructureContextConfig = appCtxService.getCtx( EP_ACTIVE_STRUCTURE_CONFIG );
    const configFlagContext = epStructureContextConfig.excludedFlagsState;
    let epExcludedByEffectivity = false;
    let epShowExcludedAssignments = false;
    let epShowExcludedByVariant = false;

    if( configFlagContext ) {
        if( configFlagContext.epExcludedByEffectivity ) {
            epExcludedByEffectivity = configFlagContext.epExcludedByEffectivity;
        }
        if( configFlagContext.epShowExcludedAssignments ) {
            epShowExcludedAssignments = configFlagContext.epShowExcludedAssignments;
        }
        if( configFlagContext.epShowExcludedByVariant ) {
            epShowExcludedByVariant = configFlagContext.epShowExcludedByVariant;
        }
    }
    return {
        epExcludedByEffectivity,
        epShowExcludedAssignments,
        epShowExcludedByVariant
    };
}
/**
 * @param {Object} revisionRuleObject - revision rule
 * @param {Object} occContext - occ context
 *
 */
function handleOccRevisionRuleChanged( revisionRuleObject, occContext ) {
    const awb0CurrentRevRule = {
        value: [ revisionRuleObject.uid ],
        displayValue: [ revisionRuleObject.props.object_name.uiValues[0] ],
        propType: 'STRING',
        isArray: false,
        displayName: 'awb0CurrentRevRule'
    };
    occContext.productContextInfo.props.awb0CurrentRevRule =
    viewModelObjectService.constructViewModelProperty( awb0CurrentRevRule, 'awb0CurrentRevRule', revisionRuleObject, false );
}

/**
 * Finds the scope key depending on the page and the Structure type
 * @param {String} sublocation sublocation token
 * @param {Object} structureType type of structure being configured
 * @returns {String }scope the scope to set for configuration
 */
function evaluateStructureScope( sublocation, structureType ) {
    let scope = '';
    const loadedObject = 'epTaskPageContext.loadedObject';
    if( structureType === 'processStructure' ) {
        if( sublocation === 'functionalPlan' ||  sublocation === 'multiBOMManager' ||  sublocation === 'manageWorkPackageNewSubLocation' ) {
            scope = '';
        } else{
            scope = loadedObject;
        }
    } else if ( structureType === 'functionalPlan' ) {
        if( sublocation === 'functionalPlan' ) {
            scope = loadedObject;
        } else{
            scope = '';
        }
    }
    return scope;
}
/**
 *
 * @param {*} eventData
 * @param {*} subPanelContext
 * @param {*} configData
 */
function handleNewGroupEffectivityCreated( eventData, subPanelContext, configData ) {
    if ( eventData && eventData.vmc && eventData.vmc.name === 'unitGroupEffDataProvider' ) {
        const newGroupEffectivityCreated = eventData.newObjects.find( obj=>obj.type === 'Fnd0EffectvtyGrpRevision' );
        if ( newGroupEffectivityCreated ) {
            subPanelContext.occContext.productContextInfo.props.awb0EffectivityGroups.dbValues = [ newGroupEffectivityCreated.uid ];
            subPanelContext.occContext.productContextInfo.props.awb0EffectivityGroups.uiValues = newGroupEffectivityCreated.props.object_name.uiValues;

            mfeViewModelUtils.mergeValueInAtomicData( configData, { newGroupEffectivity:  [ newGroupEffectivityCreated.uid ] } );
        }
    }
}
/**
 *
 * @param {*} setProperty
 * @param {*} unsetProperty
 * @param {*} subPanelContext
 */
function updateDataAfterNavigatePanel(
    setProperty,
    unsetProperty,
    subPanelContext,
    configData
) {
    let propertyUid = null;
    let  propertyObject = null;
    if ( setProperty && subPanelContext.occContext ) {
        if ( 'awb0CurrentRevRule' === setProperty ) {
            propertyUid = subPanelContext.occContext.configContext.r_uid;
        }else{
            const uids = subPanelContext.occContext.configContext.eg_uids;
            propertyUid = uids[uids.length - 1];
        }
        if ( !propertyObject && propertyUid ) {
            propertyObject = cdmSvc.getObject( propertyUid );
        }
        if ( propertyObject ) {
            subPanelContext.occContext.productContextInfo.props[setProperty].dbValues = [ propertyObject.uid ];
            subPanelContext.occContext.productContextInfo.props[setProperty].uiValues = propertyObject.props.object_name.uiValues;

            if ( setProperty === 'awb0EffDate' ) {
                mfeViewModelUtils.mergeValueInAtomicData( configData, {  effectivityGroups:
                subPanelContext.occContext.productContextInfo.props[setProperty].dbValues  }  );
            } else if ( setProperty === 'awb0EffectivityGroups' ) {
                mfeViewModelUtils.mergeValueInAtomicData( configData, {  effectiveUnit: null,
                    effectivityGroups : subPanelContext.occContext.productContextInfo.props[setProperty].dbValues } );
            } else if ( setProperty === 'awb0CurrentRevRule' ) {
                mfeViewModelUtils.mergeValueInAtomicData( configData, {
                    revisionRule : subPanelContext.occContext.productContextInfo.props[setProperty].dbValues } );
            }
        }
    }

    if ( unsetProperty ) {
        subPanelContext.occContext.productContextInfo.props[unsetProperty].dbValues = [];
        subPanelContext.occContext.productContextInfo.props[unsetProperty].uiValues = [];
    }
}
/**
 *
 * @param {*} subPanelContext
 * @param {*} configData
 */
function handleRemoveEffectivityGroups( subPanelContext, configData ) {
    if ( subPanelContext.occContext ) {
        const uids = [ ...subPanelContext.occContext.configContext.eg_uids ];
        subPanelContext.occContext.productContextInfo.props.awb0EffectivityGroups.dbValues = uids;
        subPanelContext.occContext.productContextInfo.props.awb0EffectivityGroups.uiValues = uids.map( remainedObjectUid => cdmSvc.getObject( remainedObjectUid ).props.object_name.uiValues[0] );
        mfeViewModelUtils.mergeValueInAtomicData( configData, { effectivityDateRange : subPanelContext.occContext.productContextInfo.props.awb0EffectivityGroups.dbValues } );
        eventBus.publish( 'groupEffectivitiesView.groupEffectivitiesRemoved' );
    }
}
export default {
    initialize,
    updateConfigurationFilterPanelData,
    clearConfigData,
    updateConfigData,
    activateStructureContext,
    saveChanges,
    getConfigFilterPanelTitle,
    saveConfigurationFlags,
    handleResponse,
    setExcludedFlagsStatus,
    isDirty,
    handleOccRevisionRuleChanged,
    getConfigurationToSave,
    getRelatedObjects,
    evaluateStructureScope,
    updateDataAfterNavigatePanel,
    handleNewGroupEffectivityCreated,
    handleRemoveEffectivityGroups
};
