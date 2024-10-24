// Copyright (c) 2022 Siemens

/**
 * @module js/discoverySubscriptionService
 */
import appCtxSvc from 'js/appCtxService';
import aceConfiguratorTabsEvaluationService from 'js/aceConfiguratorTabsEvaluationService';
import aceFilterService from 'js/aceFilterService';
import cdmService from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import discoveryFilterService from 'js/discoveryFilterService';
import discoveryPropertyPolicyService from 'js/discoveryPropertyPolicyService';
import createWorksetService from 'js/createWorksetService';
import occmgmtUtils from 'js/occmgmtUtils';
import messageSvc from 'js/messagingService';
import localeSvc from 'js/localeService';
import occmgmtSubsetUtils from 'js/occmgmtSubsetUtils';
import structureFilterService from 'js/structureFilterService';
import occmgmtGetSvc from 'js/occmgmtGetService';
import occmgmtTreeLoadResultBuilder from 'js/occmgmtTreeLoadResultBuilder';
import AwStateService from 'js/awStateService';
import occmgmtStateHandler from 'js/occurrenceManagementStateHandler';
import csidToObjectConvSvc from 'js/csidsToObjectsConverterService';

var exports = {};
var _eventSubDefs = [];
var _continueWithUnsaved = false;
var _contextKey = null;
var _showingUserChoiceForWorksetSave;
var _showingUserChoiceForWorksetRefresh;

const WORKSET_REVISION = 'WorksetRevision';
const APPSESSION_WORKSET = 'AppSessionWorkset';
const FND0WORKSET_REVISION = 'Fnd0WorksetRevision';

/**
  * Initialize
  * @param {Object} continueWithoutSave set flag indicating continue without save usecase
*/
export let setContinueWithUnsaved = function( continueWithoutSave ) {
    _continueWithUnsaved = continueWithoutSave;
};

export let postProcessingWorksetSaveAsRevise = function( newObjectUid, topElement, openedObjectType ) {
    // Below publish event will add the newly created workset in interacted product list
    // so that getOcc SOA will get called with restore mode. This is needed so that the server
    // can create the autobookmark on getOcc call
    let createdObject = {
        uid: newObjectUid
    };
    let eventData = {
        createdObject: createdObject
    };
    eventBus.publish( 'swc.objectCreated', eventData );
    if ( _continueWithUnsaved && openedObjectType !== undefined && openedObjectType === WORKSET_REVISION && topElement !== undefined ) {
        // continueWithUnSaved true reflects workset is dirty
        let localizedMessages = localeSvc.getLoadedText( 'OccurrenceManagementSubsetConstants' );
        let openedWorksetObject = cdmService.getObject( topElement.props.awb0UnderlyingObject.dbValues[0] );
        if ( openedWorksetObject.props.is_modifiable.dbValues[0] === '1' ) {
            messageSvc.showInfo( localizedMessages.saveAsWorksetWithPersistedChanges );
        } else{
            messageSvc.showInfo( localizedMessages.saveAsWorksetWithNoWriteAccess );
        }
    }
    _continueWithUnsaved = false;
};

let initializeContextKey = function( key ) {
    _contextKey = key;
};

/**
 * Evaluate the visibility of "Variant Conditions" tab
 * @param {Array} selectedObjs The selected objects collection
 * @param {Object} occContextValue Context passed to ACE sub-location
 * @returns {boolean} true if Variant Condition Authoring tab is visible and false otherwise
 */
let _evaluateVariantConditionsTabVisibility = function( selectedObjs, occContextValue ) {
    let enableVCA = false;
    if ( _.get( occContextValue, 'supportedFeatures.Awb0SupportsVariantConditionAuthoring' ) && !_.get( appCtxSvc, 'ctx.splitView.mode' ) ) {
        // Verify that the selected objects are valid and belong to the same product.
        let validSelections = occmgmtSubsetUtils.validateSelectionsToBeInSingleProductFromOccContext( true, occContextValue );
        if( validSelections.length === selectedObjs.length ) {
            // Now call the ace service to verify that the selections are valid for VCA.
            enableVCA = aceConfiguratorTabsEvaluationService.evaluateVariantConditionsTabVisibilityOnSelection( selectedObjs, occContextValue );
        }
    }
    return enableVCA;
};

/**
 * Evaluate the visibility of "Variant Configuration" tab
 * @param {Object} selectedObjs An array of currently selected objects
 * @param {Object} occContextValue An updated version of subPanelContext objectprovided by the parent view
 * @returns {boolean} true if Variant Configuration tab is visible and false otherwise
 */
let _evaluateVariantConfigurationTabVisibility = function( selectedObjs, occContextValue ) {
    let enableVCV = false;
    if ( _.get( occContextValue, 'supportedFeatures.Awb0SupportsFullScreenVariantConfiguration' ) && !_.get( appCtxSvc, 'ctx.splitView.mode' ) ) {
        // Verify that the selected objects are valid and belong to the same product.
        let validSelections = occmgmtSubsetUtils.validateSelectionsToBeInSingleProductFromOccContext( false, occContextValue );
        if( validSelections.length === selectedObjs.length ) {
            enableVCV = true;
        }
    }
    return enableVCV;
};


/**
* Pre getOccurrences SOA extension point registration
*/
const registerPreGetOccDiscoveryExtPoints = function() {
    // Variant change handler registration
    let variantInfoChangeConditionFunc = function( _loadInput, occContext ) {
        //  We need this handling due to VOO changes.
        // The AW server expected filterOrRecipeChange to be true when removing VOO via
        // "No Variant Rule" action in client. This is because although VOO is shown as a
        // variant rule in UI, it is actually a Recipe option and is bookmarked via Recipe.
        // Check for VARIANT_RULE_CHANGE user gesture and if it is present then
        // we can conclude that user is trying to unset the VOO via SVR application.
        if( occContext && occContext.transientRequestPref && occContext.transientRequestPref.userGesture &&  occContext.transientRequestPref.userGesture === 'VARIANT_RULE_CHANGE' && occContext.supportedFeatures.Awb0ConfiguredByProximity ) {
            return true;
        }
        return false;
    };
    let variantInfoChangeOccInputFunc = function( _loadInput, _occContext, _currentContext, soaInput ) {
        soaInput.inputData.requestPref.filterOrRecipeChange = [ 'true' ];
    };

    let variantChangeExtPoint = {
        key : 'discoveryVariantChangeHandler', //unique identifier
        condition: variantInfoChangeConditionFunc,
        populateGetOccInput: variantInfoChangeOccInputFunc
    };
    occmgmtGetSvc.registerGetOccInputProvider( variantChangeExtPoint );

    // Discovery Reset structure handler registration
    let resetStructureConditionFunc = function( _loadInput, occContext ) {
        if( occContext && occContext.transientRequestPref && ( occContext.transientRequestPref.savedSessionMode === 'reset' || occContext.transientRequestPref.replayRecipe === 'true' ) && ( discoveryFilterService.isDiscoveryIndexed() ||
            occContext.topElement.modelType.typeHierarchyArray.indexOf( 'Fnd0AppSession' ) > -1 || createWorksetService.isWorkset( appCtxSvc.ctx.mselected[0] ) ) ) {
            return true;
        }
        return false;
    };
    let resetStructureOccInputFunc = function( ) {
        discoveryFilterService.clearAllCacheOnReset();
        discoveryFilterService.setResetInitiated();
    };
    let resetStructureExtPoint = {
        key : 'discoveryResetStructureHandler', //unique identifier
        condition: resetStructureConditionFunc,
        populateGetOccInput: resetStructureOccInputFunc
    };
    occmgmtGetSvc.registerGetOccInputProvider( resetStructureExtPoint );

    // Discovery config change structure handler registration
    let configChangeConditionFunc = function( _loadInput, occContext ) {
        if(  !_.isEmpty( occContext.configContext ) && ( discoveryFilterService.isDiscoveryIndexed() || createWorksetService.isAutoSaveWorksetEnabled( occContext.openedObjectType ) ) ) {
            return true;
        }
        return false;
    };
    let configChangeOccInputFunc = function( _loadInput, occContext ) {
        if( discoveryFilterService.isDiscoveryIndexed() ) {
            discoveryFilterService.clearAllCacheOnReset();
        }
        if( createWorksetService.isAutoSaveWorksetEnabled( occContext.openedObjectType ) ) {
            registerPartialErrorOverride(  );
        }
    };
    let configChangeExtPoint = {
        key : 'discoveryConfigChangeHandler', //unique identifier
        condition: configChangeConditionFunc,
        populateGetOccInput: configChangeOccInputFunc
    };
    occmgmtGetSvc.registerGetOccInputProvider( configChangeExtPoint );

    // Discovery filter param input handler
    let filterParamConditionFunc = function( treeLoadInput, occContext ) {
        // Return FALSE if 4GD Feature
        var supportedFeatures =  occmgmtStateHandler.getSupportedFeaturesFromPCI( cdmService.getObject( occContext.currentState.pci_uid ) );
        if( supportedFeatures && supportedFeatures['4GStructureFeature'] ) {
            return false;
        }
        return true;
    };
    let filterParamInputFunc = function( loadInput, occContext, currentContext, soaInput ) {
        // Always send calculateFilters to true when filter panel is open
        if( appCtxSvc.ctx.sidenavCommandId && appCtxSvc.ctx.sidenavCommandId === 'Awb0StructureFilterCommand' && discoveryFilterService.isDiscoveryIndexed() ) {
            soaInput.inputData.requestPref.calculateFilters = [ 'true' ];
        }
        // Populate filter params in SOA input
        if ( occContext.openedObjectType === WORKSET_REVISION || occContext.openedObjectType === APPSESSION_WORKSET  || discoveryFilterService.isDiscoveryIndexed() ) {
            populateDiscoveryFilterParams( soaInput.inputData, currentContext, occContext );
        } else {
            populateFilterParameters( loadInput, occContext, currentContext, soaInput );
        }
        let wsRevision;
        if ( occContext.openedObjectType === WORKSET_REVISION ) {
            wsRevision = cdmService.getObject( occContext.topElement.props.awb0UnderlyingObject.dbValues[0] );
        } else if ( occContext.openedObjectType === APPSESSION_WORKSET ) {
            wsRevision = cdmService.getObject( occContext.rootElementInSession.props.awb0UnderlyingObject.dbValues[0] );
        }
        if( wsRevision && wsRevision.props.lsd ) {
            soaInput.inputData.requestPref.worksetRevLastSavedDate = [ wsRevision.props.lsd.dbValues[0] ];
        }
    };
    let filterParamExtPoint = {
        key : 'discoveryFilterParamHandler', //unique identifier
        condition: filterParamConditionFunc,
        populateGetOccInput: filterParamInputFunc
    };
    occmgmtGetSvc.registerGetOccInputProvider( filterParamExtPoint );
};

// NOTE-->
// This extension point implementation for post getElementsForIds is implemented as a point fix from client in tc2312.
// A proper solution is to refactor in the OccurrenceNavigators in AW server code. This code piece has been identified as a
// candidate for refactoring and following story, LCS-906193 will account for this work.
/***************************************** ABOUT THIS FIX ******************************************************************
* Pre-requisite: Either open AppSession in AppConnect mode from Standalone Vis
*                                         OR
*                Disable tcserver sharing for embedded 3D viewer in AW Client
* Steps:
* 1. Open AppSession and enable either 3D in AW client or you are visualizing the same AppSession in AppConnect mode in
*    standalone mode.
* 2. Terminate all tcserver.exe processes, the idea is to make sure that we get a new server assigned when we do next action
* 3. Now, select something in from Vis either in 3D or AppConnect. This selection will make sure that a getElementsForIds SOA
*    is called and a bomwindow recovery will happen based on input PCI and a new Awb0Element will be sent back to client. For
*    this newly created element we will not have any valid parent in the current tree and we need to identify this case here.
* 4. When we identify the case that we do not have the same root element between the already loaded tree and the new element
*    then, we make sure that the next getOcc call for focused occurrence navigation sends "startFreshNavigation = true". This
*    param will make sure that the AW server will close the current bomwindow and create a new one in context of Session and
*    will also return a complete parentChildrenInfo structure starting from AppSession and ending at the parent of input
*    focused occurrence. This makes sure that the client has complete knowledge and does not mis-merge the tree entries.
****************************************************************************************************************************/
let regPostGetElementsForIdsDiscoveryExtPoint = function() {
    // Basic things we need for this extention to work as expected.
    let view =  appCtxSvc.getCtx().aceActiveContext.key;

    let isHandlerSupported = () => {
        // Only supported if we are in Session
        let occmgmtContext = _.get( appCtxSvc.getCtx(), view );
        return occmgmtContext.topElement.modelType.typeHierarchyArray.indexOf( 'Fnd0AppSession' ) > -1;
    };

    let postGetElementsForIdFunc = ( resposne ) => {
        let occmgmtContext = _.get( appCtxSvc.getCtx(), view );
        let loadedVMO = occmgmtContext.vmc.getLoadedViewModelObjects();

        // Extract the root element from the current set of selections returned from getElementsFromIds
        let selectedElement = resposne.elementsInfo[0].element;
        let parentElementUid = selectedElement.props.awb0Parent.dbValues[0];
        let parentObj;
        while( cdmService.isValidObjectUid( parentElementUid ) ) {
            parentObj = cdmService.getObject( parentElementUid );
            parentElementUid = parentObj.props.awb0Parent.dbValues[0];
        }

        // Get the uid of root element found above and check if it is present in the loaded VMOs
        let uidToCheck = selectedElement.uid;
        if( !_.isUndefined( parentObj ) ) {
            uidToCheck = parentObj.uid;
        }

        const isUIDPresent = _.some( loadedVMO, ( eachVMO ) => {
            return eachVMO.uid === uidToCheck;
        } );

        // If the UID of root object does not match any of the UIDs in the loaded VMOs, then we need to make sure that the server sends complete
        // parentChildrenInfo including the Session object in its response for getOcc with focus.
        if( !isUIDPresent ) {
            // Set startFreshNavigation as true so that the next getOcc call creates complete parentChildrenInfo structure
            let value = { startFreshNavigation : [ 'true' ] };
            occmgmtUtils.updateValueOnCtxOrState( 'transientRequestPref', value, view, true );
        }
    };

    let postGetElementsForIdExtPoint = {
        key : 'discoveryPostGetElementsForIdHandler', //unique identifier
        condition: isHandlerSupported,
        postGetElementsForIdsAction: postGetElementsForIdFunc
    };

    csidToObjectConvSvc.registerPostGetElementsForIDsHandler( postGetElementsForIdExtPoint );
};

/**
* Post getOccurrences SOA extension point registration
*/
let registerPostGetOccDiscoveryExtPoints = function() {
    // Post getOccurrences response handler registration
    let postGetOccConditionFunc = function( ) {
        return true;
    };
    let postGetOccFunc = function( _response, finalOccContextValue, _treeLoadInput, treeLoadOutput ) {
        _setOpenedObjectInfo( finalOccContextValue, treeLoadOutput );
    };
    let postGetOccExtPoint = {
        key : 'discoveryPostGetOccHandler', //unique identifier
        condition: postGetOccConditionFunc,
        addOccContextAtomicDataForUpdate: postGetOccFunc
    };
    occmgmtTreeLoadResultBuilder.registerOccContextAtomicDataProvider( postGetOccExtPoint );
    // End Post getOccurrences response handler registration

    // Post getOccurrences filter handler registration
    let postGetOccFilterConditionFunc = function( soaInput  ) {
        if( soaInput && soaInput.inputData && soaInput.inputData.requestPref &&
            ( soaInput.inputData.requestPref.filterOrRecipeChange &&  soaInput.inputData.requestPref.filterOrRecipeChange[0] === 'true' ) ||
             soaInput.inputData.requestPref.filterChange &&  soaInput.inputData.requestPref.filterChange[0] === 'true'  ) {
            return true;
        }
        return false;
    };
    let postGetOccFilterFunc = function( response, finalOccContextValue, treeLoadInput, treeLoadOutput ) {
        performPostProcessingForFilterChange( response, finalOccContextValue, treeLoadInput, treeLoadOutput );
    };
    let postGetOccFilterExtPoint = {
        key : 'discoveryPostGetOccFilterHandler', //unique identifier
        condition: postGetOccFilterConditionFunc,
        addOccContextAtomicDataForUpdate: postGetOccFilterFunc
    };
    occmgmtTreeLoadResultBuilder.registerOccContextAtomicDataProvider( postGetOccFilterExtPoint );
};

export let initialize = function( contextKey ) {
    // Register property policy overrides form discovery subtypes.
    discoveryPropertyPolicyService.registerPropertyPolicy();
    discoveryFilterService.setContextKey( contextKey );
    createWorksetService.setContextKey( contextKey );
    initializeContextKey( contextKey );

    registerPostGetOccDiscoveryExtPoints();
    registerPreGetOccDiscoveryExtPoints();
    regPostGetElementsForIdsDiscoveryExtPoint();

    _eventSubDefs.push( eventBus.subscribe( 'appCtx.register', function( eventData ) {
        if( eventData.name === 'mselected' && appCtxSvc.getCtx( _contextKey )  ) {
            evaluateValidityOfSelections();
        }
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'appCtx.update', function( data ) {
        let occMgmtCtx = appCtxSvc.getCtx( _contextKey );
        if( data.target === 'isRestoreOptionApplicableForProduct' && occMgmtCtx && occMgmtCtx.productContextInfo && occMgmtCtx.productContextInfo &&
        occMgmtCtx.productContextInfo.props.awb0Snapshot !== undefined && occMgmtCtx.productContextInfo.props.awb0Snapshot.dbValues[0] !== '' && !_.isNull( occMgmtCtx.productContextInfo.props.awb0Snapshot.dbValues[0] ) ) {
            occmgmtUtils.updateValueOnCtxOrState( 'isRestoreOptionApplicableForProduct', false, contextKey );
        }
        if(  data.name === 'aceActiveContext' ) {
            evaluateValidityOfSelections();
        }
    } ) );

    // Subscribe to elementsAdded for addition of subset handling
    _eventSubDefs.push( eventBus.subscribe( 'addElement.elementsAdded', function( eventData ) {
        let updatedParentElement = eventData.updatedParentElement;
        let newElements = eventData.addElementResponse.selectedNewElementInfo.newElements;
        if( !updatedParentElement ) {
            updatedParentElement = eventData.addElementInput && eventData.addElementInput.parent ? eventData.addElementInput.parent : appCtxSvc.getCtx( _contextKey ).addElement.parent;
        }
        if( newElements && newElements.length > 0 && createWorksetService.isWorkset( updatedParentElement ) ) {
            let soaInput = occmgmtGetSvc.getDefaultSoaInput();
            // Setting returnChildrenNoExpansion true, will honor and process expandedNodes requestpref at server side while processing getOcc call
            // As a result, complete parentChildrenInfo map will be created in getOcc responce.
            soaInput.inputData.requestPref.returnChildrenNoExpansion = [ 'true' ];
            if ( newElements.length === 1 ) {
                soaInput.inputData.focusOccurrenceInput.element = occmgmtUtils.getObject( _.last( newElements ).uid );
            }

            if( createWorksetService.isAppSessionWorkset( appCtxSvc.getCtx( _contextKey ).topElement, appCtxSvc.getCtx( _contextKey ).elementToPCIMap ) ) {
                // Send startFreshNavigation to true when subset is added to Workset in Session - this will ensure Subset is selected after add
                soaInput.inputData.requestPref.startFreshNavigation = [ 'true' ];
            }
            eventBus.publish( 'aceLoadAndSelectProvidedObjectInTree', {
                objectsToSelect: newElements,
                viewToReact: _contextKey,
                parentToExpand: updatedParentElement.uid,
                updateVmosNContextOnPwaReset: true,
                getOccSoaInput: soaInput,
                retainExpansionState : true
            } );
        }
    } ) );


    // Subscribe to event produced by ace framework to inform sub-modules in ace to provide an evaluation of visibility for configurator tabs (VCV/VCA)
    _eventSubDefs.push( eventBus.subscribe( 'ace.evaluateConfiguratorTabsVisibility', function( eventData ) {
        if ( eventData && eventData.selections && eventData.occContext && eventData.occContext.openedObjectType && ( eventData.occContext.openedObjectType === 'WorksetRevision' || eventData.occContext.openedObjectType === 'AppSessionWorkset' ) ) {
            let configuratorViewsDisplayContext = {
                showVariantConditionsView : _evaluateVariantConditionsTabVisibility( eventData.selections, eventData.occContext ),
                showVariantConfigurationView : _evaluateVariantConfigurationTabVisibility( eventData.selections, eventData.occContext )
            };
            appCtxSvc.updatePartialCtx( 'configuratorViewsDisplayContext', configuratorViewsDisplayContext );
        }
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'workset.overridePartialErrorProcessing', function( ) {
        registerPartialErrorOverride();
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'submissionSuccessful', function( eventData ) {
        if( createWorksetService.isAutoSaveWorksetEnabled( eventData.createChangeData.subPanelContext.occContext.openedObjectType ) && eventData.createChangeData.pageId === 'Awp0NewWorkflowProcessWorkflowTab' ) {
            // Reload PWA now.
            let occContextValue = {
                pwaReset: true
            };
            occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, eventData.createChangeData.subPanelContext.occContext );
        }
    } ) );
};

var populateDiscoveryFilterParams = function( inputData, currentContext, occContext ) {
    inputData.filter.searchFilterCategories = [];
    inputData.filter.searchFilterMap = {};
    let recipe;

    //Populate recipe when recipe is modified via applying proximity or delete or operator change
    if( occContext.updatedRecipe ) {
        recipe = occContext.updatedRecipe;
        inputData.requestPref.recipeUpdated =  [ 'true' ];
    }

    inputData.filter.fetchUpdatedFilters = false;
    inputData.filter.recipe = [];
    let criteriaTypeStr = currentContext.requestPref.criteriaType;

    if( criteriaTypeStr ) {
        let recipeInfo = {
            criteriaType: criteriaTypeStr
        };

        inputData.filter.recipe.push( recipeInfo );
    }

    if( recipe ) {
        inputData.filter.recipe.push.apply( inputData.filter.recipe, recipe );
    }

    inputData.filter.searchFilterFieldSortType = 'Priority';
    inputData.filter.searchSortCriteria = [];
};

var processFilterStringInfoForAceIndexedProduct = function( loadInput, occContext, currentContext, soaInput ) {
    let inputFilterString;

    // Processing for the expansion through breadcrumb path and multi product scenarios
    if( occContext.elementToPCIMap ) {
        let pci_uid;
        if( loadInput.pci_uid ) {
            pci_uid = loadInput.pci_uid;
        } else if( loadInput.parentNode ) {
            pci_uid = occmgmtUtils.getProductContextForProvidedObject( loadInput.parentNode, occContext );
        }
        if( pci_uid ) {
            soaInput.inputData.config.productContext = occmgmtUtils.getObject( pci_uid );
            // Get Filter string for product being expanded if product is not active product
            if( pci_uid !== occContext.currentState.pci_uid && ( !soaInput.inputData.requestPref.calculateFilters || soaInput.inputData.requestPref.calculateFilters[0] === 'false' ) ) {
                inputFilterString = structureFilterService.computeFilterStringForNewProductContextInfo( pci_uid );
            }
        }
    }else if( loadInput.pci_uid !== undefined && loadInput.pci_uid !== occContext.currentState.pci_uid && ( !soaInput.inputData.requestPref.calculateFilters || soaInput.inputData.requestPref.calculateFilters[0] === 'false' ) ) {
        inputFilterString = structureFilterService.computeFilterStringForNewProductContextInfo( loadInput.pci_uid );
    }

    let filterString = null;
    let parentElementUid = loadInput.parentElement;

    // Get Filter string for filter input
    if( inputFilterString !== undefined && inputFilterString !== null ) {
        filterString = inputFilterString;
    } else {
        let object =  cdmService.getObject( parentElementUid );
        if( object ) {
            let pciForSelection =  occmgmtUtils.getProductContextForProvidedObject( object, occContext );
            if( pciForSelection ) {
                let computedFilterString = structureFilterService.computeFilterStringForNewProductContextInfo( pciForSelection );
                filterString = computedFilterString;
            } else{
                filterString = occContext.currentState.filter;
            }
        }else{
            if( appCtxSvc.ctx.splitView ) {
                filterString = AwStateService.instance.params[ appCtxSvc.getCtx( _contextKey ).urlParams.subsetFilterParamKey ];
            } else {
                filterString = occContext.currentState.filter;
            }
        }
    }
    return filterString;
};

var populateFilterParameters = function( loadInput, occContext, currentContext, soaInput  ) {
    let filterString = processFilterStringInfoForAceIndexedProduct( loadInput, occContext, currentContext, soaInput );
    let filter = soaInput.inputData.filter;
    filter.searchFilterCategories = [];
    filter.searchFilterMap = {};

    // Populate filters/recipe only when filters are applied from this action OR when a filtered structure is being refreshed
    // or expanded
    let recipe;
    if( occContext.appliedFilters ) {
        recipe = occContext.recipe;
        let appliedFilters = occContext.appliedFilters;
        if( appliedFilters.filterCategories && appliedFilters.filterMap ) {
            filter.searchFilterCategories = appliedFilters.filterCategories;
            filter.searchFilterMap = appliedFilters.filterMap;
        }
    } else if( filterString && !currentContext.updatedRecipe ) {
        if( !occmgmtSubsetUtils.isUserGestureToChangeConfig( occContext ) ) {
            let categoriesInfo = aceFilterService.extractFilterCategoriesAndFilterMap( filterString );
            filter.searchFilterCategories = categoriesInfo.filterCategories;
            filter.searchFilterMap = categoriesInfo.filterMap;
            recipe = currentContext.recipe;
        }

        // Set calculateFilters to true as they are needed to initialize the filter panel
        // in case of ACE indexed product refresh
        if( loadInput.openOrUrlRefreshCase === 'urlRefresh' || loadInput.openOrUrlRefreshCase === 'backButton' ) {
            soaInput.inputData.requestPref.calculateFilters = [ 'true' ];
        }
    }

    if( occContext.updatedRecipe ) {
        recipe = occContext.updatedRecipe;
        soaInput.inputData.requestPref.recipeUpdated =  [ 'true' ];
    }

    filter.fetchUpdatedFilters = false;
    filter.recipe = [];
    let criteriaTypeStr = currentContext.requestPref.criteriaType;

    if( criteriaTypeStr ) {
        let recipeInfo = {
            criteriaType: criteriaTypeStr
        };
        filter.recipe.push( recipeInfo );
    }

    if( recipe ) {
        filter.recipe.push.apply( filter.recipe, recipe );
    }

    filter.searchFilterFieldSortType = 'Priority';
    filter.searchSortCriteria = [];
};


var performPostProcessingForFilterChange = function( response, finalOccContextValue, treeLoadInput, treeLoadOutput ) {
    let publishContentReloadedEvent = true;
    if( !_.isUndefined( response.ServiceData.partialErrors ) && response.ServiceData.partialErrors.length > 0 ) {
        // If there are partial errors returned by SOA, then we do not need to publish an event for 3D Viewer.
        publishContentReloadedEvent = false;
    }

    if( treeLoadInput.subPanelContext && treeLoadInput.subPanelContext.occContext &&
        ( treeLoadInput.subPanelContext.occContext.updatedRecipe || treeLoadInput.subPanelContext.occContext.appliedFilters ) ) {
        discoveryFilterService.clearTransientRecipeInfo();
        //Publish the event so that any views that are interested when the PWA contents are updated
        //due to filter/recipe change update as necessary. Currently, this will be used by 3D Viewer.
        //This event must not be published in case of Workset or AppSession in Workset in 14.2 where
        //update of 3DViewer(SWA tabs) is performed based on reloadDependentTabs requestPref in getOcc
        //SOA response

        if( publishContentReloadedEvent && !createWorksetService.isAutoSaveWorksetEnabled( treeLoadOutput.openedObjectType ) ) {
            eventBus.publish( 'primaryWorkArea.contentsReloaded', {
                viewToReact: _contextKey
            } );
        }
        if( finalOccContextValue.updatedRecipe ) {
            finalOccContextValue.updatedRecipe = undefined;
        }
        if( finalOccContextValue.appliedFilters ) {
            finalOccContextValue.appliedFilters = undefined;
        }
    }
};

var _setOpenedObjectInfo = ( finalOccContextValue, treeLoadOutput ) => {
    if( treeLoadOutput.openedObjectType === WORKSET_REVISION ) {
        let openedObject = cdmService.getObject( treeLoadOutput.topElement.props.awb0UnderlyingObject.dbValues[0] );
        if ( openedObject.props && openedObject.props.items_tag ) {
            let worksetItemUid = openedObject.props.items_tag.dbValues[0];
            finalOccContextValue.worksetItemObject = cdmService.getObject( worksetItemUid );
        }
    }else if( treeLoadOutput.openedObjectType === APPSESSION_WORKSET ) {
        for( let elementUid in treeLoadOutput.elementToPCIMap ) {
            let pciUid = treeLoadOutput.elementToPCIMap[ elementUid ];
            let pciObject = cdmService.getObject( pciUid );
            if( pciObject ) {
                let productObject = cdmService.getObject( pciObject.props.awb0Product.dbValues[ 0 ] );
                let isAppSessionWithWorkset = productObject && productObject.modelType.typeHierarchyArray.indexOf( FND0WORKSET_REVISION ) > -1;

                if( isAppSessionWithWorkset ) {
                    finalOccContextValue.rootElementInSession = cdmService.getObject( elementUid );
                    break;
                }
            }
        }
    }
};

var evaluateValidityOfSelections = function() {
    let validSelectedObjects = occmgmtSubsetUtils.validateSelectionsToBeInSingleProduct( true );
    discoveryFilterService.validateTermsToIncludeOrExclude( validSelectedObjects );
    let isInWorksetContext = createWorksetService.isWorkset( appCtxSvc.getCtx( _contextKey ).topElement );
    let isInAppSessionWorksetContext = createWorksetService.isAppSessionWorkset( appCtxSvc.getCtx( _contextKey ).topElement, appCtxSvc.getCtx( _contextKey ).elementToPCIMap );
    if ( isInWorksetContext || isInAppSessionWorksetContext ) {
        let currentVisibility = _.get( appCtxSvc, 'ctx.filter.validSelectionsInSingleSubsetInWorkset' );
        if( validSelectedObjects && validSelectedObjects.length >= 1 && validSelectedObjects.length === appCtxSvc.ctx.mselected.length ) {
            if( !currentVisibility ) {
                occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsInSingleSubsetInWorkset', true, 'filter' );
            }
        } else if( currentVisibility || _.isUndefined( currentVisibility ) ) {
            occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsInSingleSubsetInWorkset', false, 'filter' );
        }
    }

    // TODO: Unable to remove context key dependency as there is no way we can identify pci of a selected Awb0DesignElement objects
    // for comparison with all selections to ensure all selections belong to same subset in Workset. THis can only be done in JS file by traversing the parent of selection
};

export let registerPartialErrorOverride = function( ) {
    let context = appCtxSvc.getCtx( _contextKey );
    if( context && !context.processPartialErrorsFunc ) {
        occmgmtUtils.updateValueOnCtxOrState( 'processPartialErrorsFunc', processPartialErrorsFunc, _contextKey );
    }
};

var processPartialErrorsFunc = function( soaResponse, contextState ) {
    let isFurtherProcessingReq = true;
    // Look for our specific error code in partial error.
    if( soaResponse.ServiceData.partialErrors ) {
        _.forEach( soaResponse.ServiceData.partialErrors, function( partialError ) {
            _.forEach( partialError.errorValues, function( errorValue ) {
                let resource = 'OccurrenceManagementSubsetConstants';
                let localTextBundle = localeSvc.getLoadedText( resource );
                if( errorValue.code === 126276 ) {
                    if( _showingUserChoiceForWorksetSave ) {
                        isFurtherProcessingReq = false;
                        return isFurtherProcessingReq;
                    }
                    _showingUserChoiceForWorksetSave = true;
                    // Create buttons for concurrent save warning message.
                    let buttons = [ {
                        addClass: 'btn btn-notify',
                        text: localTextBundle.CancelText,
                        onClick: function( $noty ) {
                            _showingUserChoiceForWorksetSave = false;
                            $noty.close();
                            // Case: Cancel
                            eventBus.publish( 'ace.cancelUserChanges' );
                        }
                    },
                    {
                        addClass: 'btn btn-notify',
                        text: localTextBundle.OverwriteText,
                        onClick: function( $noty ) {
                            $noty.close();
                            _showingUserChoiceForWorksetSave = false;
                            // Case: Overwrite
                            eventBus.publish( 'ace.redoUserChanges' );
                        }
                    } ];

                    // display the pop-up dialog now with warning info.
                    messageSvc.showWarning( errorValue.message, buttons );
                    // Inform framework that we will take care of message display and do not need them
                    // to process it any further after we are done.
                    isFurtherProcessingReq = false;
                    return isFurtherProcessingReq;
                }
                if( errorValue.code === 126281 ) {
                    if( _showingUserChoiceForWorksetRefresh ) {
                        isFurtherProcessingReq = false;
                        return isFurtherProcessingReq;
                    }
                    _showingUserChoiceForWorksetRefresh = true;
                    // Create buttons for concurrent refresh warning message.
                    let cancelAndRefreshButton = [ {
                        addClass: 'btn btn-notify',
                        text: localTextBundle.CancelText,
                        onClick: function( $noty ) {
                            _showingUserChoiceForWorksetRefresh = false;
                            $noty.close();
                            // Case: Cancel
                            eventBus.publish( 'ace.cancelUserChanges' );
                        }
                    },
                    {
                        addClass: 'btn btn-notify',
                        text: localTextBundle.RefreshText,
                        onClick: function( $noty ) {
                            $noty.close();
                            _showingUserChoiceForWorksetRefresh = false;
                            // Case: Refresh
                            let options = {};
                            options.inherit = false;
                            options.reload = true;
                            return AwStateService.instance.go( 'com_siemens_splm_clientfx_tcui_xrt_showObject', {
                                uid: contextState.context.topElement.props.awb0UnderlyingObject.dbValues[0]
                            }, options );
                        }
                    } ];
                    // display the pop-up dialog now with warning info.
                    messageSvc.showWarning( errorValue.message, cancelAndRefreshButton );
                    // Inform framework that we will take care of message display and do not need them
                    // to process it any further after we are done.
                    isFurtherProcessingReq = false;
                    return isFurtherProcessingReq;
                }
                if ( contextState.occContext.currentState.snap_uid && errorValue.code === 126282 ) {
                    contextState.occContext.currentState.snap_uid = null;
                    contextState.context.currentState.snap_uid = null;
                    messageSvc.showError( errorValue.message );
                    isFurtherProcessingReq = false;
                    return isFurtherProcessingReq;
                }
                return isFurtherProcessingReq;
            } );
        } );
    }
    return isFurtherProcessingReq;
};

export let cancelUserChanges = function( occContext ) {
    if( occContext && occContext.transientRequestPref && occContext.transientRequestPref.filterOrRecipeChange ) {
        eventBus.publish( 'awDiscovery.recipeUpdateFailOnConcurrentSave' );
    }

    let onPwaLoadComplete = occContext.onPwaLoadComplete ? occContext.onPwaLoadComplete : 0;
    let occContextValue = {
        configContext: {},
        disabledFeatures: [],
        transientRequestPref: {},
        onPwaLoadComplete: onPwaLoadComplete + 1,
        pwaReset: undefined
    };
    occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, occContext );
};

export let redoUserChanges = function( occContext ) {
    let occContextValue = {};
    if(  occContext.transientRequestPref.filterOrRecipeChange ) {
        // Case: recipe update
        occContextValue = {
            transientRequestPref: {
                calculateFilters: true,
                retainTreeExpansionStates: true,
                filterOrRecipeChange: true,
                jitterFreePropLoad: true,
                overwrite: true
            },
            updatedRecipe: occContext.updatedRecipe,
            pwaReset: !occContext.pwaReset // resetting pwaReset value to trigger reset action
        };
    }else if( occContext.transientRequestPref.replayRecipe ) {
        // Case: replay
        occContextValue = {
            transientRequestPref: {
                replayRecipe: true,
                jitterFreePropLoad: true,
                currentSelections: occmgmtUtils.getSelectedObjectUids( occContext.selectedModelObjects ),
                overwrite: true,
                userGesture: 'REPLAY'
            },
            pwaReset: !occContext.pwaReset  // resetting pwaReset value to trigger reset action
        };
    }else if( occContext.configContext ) {
        // Case: configuration update
        occContextValue = {
            transientRequestPref: {
                overwrite: true,
                jitterFreePropLoad: true,
                userGesture: occContext.transientRequestPref.userGesture
            },
            pwaReset: !occContext.pwaReset
        };
    }
    occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, occContext );
};

export let evaluateCompareButtonVisibilityInSplitMode = function( ) {
    let urlParams = { ...AwStateService.instance.params };
    let t_uid = urlParams.t_uid;
    let currentVisibilityOfCompare = appCtxSvc.getCtx( 'splitView' ).isCompareValidForDiscovery;
    let disableCompare = false;
    if( t_uid  ) {
        let object =  cdmService.getObject( t_uid );
        if( object && object.modelType.typeHierarchyArray.indexOf( 'Fnd0AppSession' ) > -1 ) {
            disableCompare = true;
        }else if( object ) {
            let underlyingObject = cdmService.getObject( object.props.awb0UnderlyingObject.dbValues[0] );
            if( underlyingObject && underlyingObject.modelType.typeHierarchyArray.indexOf( FND0WORKSET_REVISION ) > -1 ) {
                disableCompare = true;
            }
        }
    }
    let t_uid2 = urlParams.t_uid2;
    if( t_uid2  ) {
        let object =  cdmService.getObject( t_uid2 );
        if( object && object.modelType.typeHierarchyArray.indexOf( 'Fnd0AppSession' ) > -1  ) {
            disableCompare = true;
        }else if( object ) {
            let underlyingObject = cdmService.getObject( object.props.awb0UnderlyingObject.dbValues[0] );
            if( underlyingObject && underlyingObject.modelType.typeHierarchyArray.indexOf( FND0WORKSET_REVISION ) > -1 ) {
                disableCompare = true;
            }
        }
    }
    if( disableCompare && currentVisibilityOfCompare !== false ) {
        occmgmtUtils.updateValueOnCtxOrState( 'isCompareValidForDiscovery', false, 'splitView' );
        return;
    }

    if( !disableCompare && !currentVisibilityOfCompare ) {
        occmgmtUtils.updateValueOnCtxOrState( 'isCompareValidForDiscovery', true, 'splitView' );
    }
};


/**
 * Destroy
 */
export let destroy = function() {
    _.forEach( _eventSubDefs, function( subDef ) {
        eventBus.unsubscribe( subDef );
    } );

    // Unregister property policy overrides on destroy.
    discoveryPropertyPolicyService.unRegisterPropertyPolicy();

    // unregister the post getElementForIds SOA handler.
    csidToObjectConvSvc.unregisterPostGetElementsForIDsHandler( { key : 'discoveryPostGetElementsForIdHandler' } );
};

export default exports = {
    initialize,
    destroy,
    setContinueWithUnsaved,
    postProcessingWorksetSaveAsRevise,
    redoUserChanges,
    cancelUserChanges,
    registerPartialErrorOverride,
    evaluateCompareButtonVisibilityInSplitMode
};
