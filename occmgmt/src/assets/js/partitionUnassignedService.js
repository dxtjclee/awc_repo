// Copyright (c) 2022 Siemens

/**
 * A service that manages the unassigned command specific service.<br>.
 *
 * @module js/partitionUnassignedService
 */
import occmgmtSplitViewUpdateService from 'js/occmgmtSplitViewUpdateService';
import eventBus from 'js/eventBus';
import appCtxSvc from 'js/appCtxService';
import localeService from 'js/localeService';
import occmgmtTreeLoadResultBuilder from 'js/occmgmtTreeLoadResultBuilder';
import occmgmtGetSvc from 'js/occmgmtGetService';

var exports = {};
var _removeElementListener = null;
var _destroyUnassignedServiceListener = null;
var _TRUE = [ 'true' ];
var _FALSE = [ 'false' ];

let refreshInactiveView = function() {
    var inactiveView = occmgmtSplitViewUpdateService.getInactiveViewKey();
    let occContext2 = appCtxSvc.getCtx( inactiveView );
    if( occContext2 ) {
        var isUnassignedMode = occContext2.currentState.pci_uid.includes( 'UM:1' );
        if ( isUnassignedMode ) {
            if ( inactiveView ) {
                eventBus.publish( 'acePwa.reset', { retainTreeExpansionStates: true, viewToReset: inactiveView, silentReload: true } );
            }
        }
    }
};

export let initializeUnassignedService = function() {
    appCtxSvc.registerCtx( 'unassignedView', { mode: true } );

    //Use Case:
    //If user does the unassigned member operation in the right view.
    //Then in order to show the correct connect we need to refresh the right view.
    if( !_removeElementListener ) {
        _removeElementListener = eventBus.subscribe( 'ace.elementsRemoved', function( event ) {
            refreshInactiveView();
        } );
    }

    //When user goes to home page we will have to destroy the unassigned view parameter to avoid the impact on other use cases.
    if( !_destroyUnassignedServiceListener ) {
        _destroyUnassignedServiceListener = eventBus.subscribe( 'appCtx.register', function( eventData ) {
            if ( eventData.name === 'splitView' && appCtxSvc.ctx.occmgmtContext2 !== undefined ) {
                if (  _removeElementListener  && appCtxSvc.ctx.unassignedView !== undefined && appCtxSvc.ctx.unassignedView.mode ) {
                    destroyUnassignedService();
                }
            }
        } );
    }
    exports.registerHandlerPreGetOccPartitionUnassignedExtPoints();
};

export let destroyUnassignedService = function() {
    //update the ctx values to correct as unassignView is going to destroy.
    appCtxSvc.unRegisterCtx( 'unassignedView' );

    //unsubscribe the subscribed event in the initialize service.
    eventBus.unsubscribe( _removeElementListener );
    eventBus.unsubscribe( _destroyUnassignedServiceListener );

    //take the global vars to their initial state.
    _removeElementListener = null;
    _destroyUnassignedServiceListener = null;
};


/**
 * This method update chip labels when props loaded event triggeres
 */
export let updateChipsOnPropsLoaded = function() {
    //In case of browser refresh or copy paste url.
    //The subscribed event in hte unassigned mode will get deregister and will have to register it.
    if( appCtxSvc.ctx.unassignedView === undefined ) {
        exports.initializeUnassignedService();
    }

    let partitionI18nResource = 'OccmgmtPartitionMessages';
    let partitionI18nResourceBundle = localeService.getLoadedText( partitionI18nResource );
    let separator = ' : ';
    var schemeNameChips = [];
    var inactiveView = occmgmtSplitViewUpdateService.getInactiveViewKey();
    //get the productContext info of any view to get the applied partition scheme.
    let currProductContextInfo = appCtxSvc.getCtx( inactiveView ).productContextInfo;

    if( currProductContextInfo && currProductContextInfo.props ) {
        //scheme name
        let currentSchemeName = currProductContextInfo.props.fgf0PartitionScheme.uiValues[0];
        if( currentSchemeName ) {
            let schemeChipLabel = partitionI18nResourceBundle.PartitionScheme;
            schemeChipLabel = schemeChipLabel.concat( separator, currentSchemeName );
            schemeNameChips.push( getChip( schemeChipLabel ) );
        }
    }
    return schemeNameChips;
};

let getChip = ( value ) => {
    return {
        chipType: 'STATIC',
        labelDisplayName: value
    };
};

/**
 * Register the call back function for each and every property which needs to add as a part of overridden property policy.
 */
export let registerHandlerForOverriddenHeader = function( ) {
    exports.initializeUnassignedService();

    /**
     * A handler for the assigned view. It will be responsible to inject the PartitionAssignedBreadcrumbHeader component in the breadcrumb.
     */
    let partitionAssignedHeaderFunction = function( _response, finalOccContextValue ) {
        finalOccContextValue.BreadCrumbForApplication = 'PartitionAssignedBreadcrumbHeader';
    };

    let partitionAssignedHeaderExt = {
        key : 'partitionAssignedHeader', //unique identifier
        condition: ( soaInput, treeLoadInput, treeLoadOutput ) => {
            if( treeLoadOutput.supportedFeatures.Awb0AssignedFeature ) { return true; }
            return false;
        },
        addOccContextAtomicDataForUpdate: partitionAssignedHeaderFunction
    };
    occmgmtTreeLoadResultBuilder.registerOccContextAtomicDataProvider( partitionAssignedHeaderExt );


    /**
     * A handler for the unassigned view. It will be responsible to inject the PartitionUnassignedBreadcrumbHeader component in the breadcrumb.
     */
    let partitionUnassignedHeaderFunction = function( _response, finalOccContextValue ) {
        finalOccContextValue.BreadCrumbForApplication = 'PartitionUnassignedBreadcrumbHeader';
    };

    let partitionUnassignedHeaderExt = {
        key : 'partitionUnassignedHeader', //unique identifier
        condition: ( soaInput, treeLoadInput, treeLoadOutput ) => {
            if( treeLoadOutput.supportedFeatures.Awb0UnassignedFeature ) { return true; }
            return false;
        },
        addOccContextAtomicDataForUpdate: partitionUnassignedHeaderFunction
    };
    occmgmtTreeLoadResultBuilder.registerOccContextAtomicDataProvider( partitionUnassignedHeaderExt );
};


/**
* Pre getOccurrences SOA extension point registration
*/
const registerHandlerPreGetOccPartitionUnassignedExtPoints = function() {
    let partitionUnassignedReqPrefCondition = function( ) {
        if( appCtxSvc.ctx.splitView && appCtxSvc.ctx.unassignedView !== undefined && appCtxSvc.ctx.unassignedView.mode ) {
            return true;
        }
        return false;
    };
    let partitionUnassignedReqPrefFunction = function( _loadInput, _occContext, _currentContext, _soaInput ) {
        if( _occContext.viewKey === 'occmgmtContext2' ) {
            _soaInput.inputData.requestPref.unassignedMode = _TRUE;
            //In case of focus use case, server will alway populate the tree hierarchy from bottom to top.
            //In such a cases we don't want to honoured the focus occurrence and parent element sent by a client in the getOcc inputs.
            //It can be achieved by sending startFreshNavigation as TRUE.
            if( _loadInput.dataProviderActionType === 'initializeAction' ) {
                _soaInput.inputData.requestPref.startFreshNavigation = _TRUE;
            }
        }else{
            _soaInput.inputData.requestPref.assignedMode = _TRUE;
        }
    };

    let partitionUnassignedReqPrefPoint = {
        key : 'partitionUnassignedModeHandler', //unique identifier
        condition: partitionUnassignedReqPrefCondition,
        populateGetOccInput: partitionUnassignedReqPrefFunction
    };
    occmgmtGetSvc.registerGetOccInputProvider( partitionUnassignedReqPrefPoint );
};


export default exports = {
    initializeUnassignedService,
    destroyUnassignedService,
    updateChipsOnPropsLoaded,
    registerHandlerForOverriddenHeader,
    registerHandlerPreGetOccPartitionUnassignedExtPoints
};
