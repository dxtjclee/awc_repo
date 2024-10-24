// Copyright (c) 2022 Siemens

/**
 * @module js/occmgmtSublocationService
 */
import appCtxSvc from 'js/appCtxService';
import AwStateService from 'js/awStateService';
import _ from 'lodash';
import ctxStateMgmtService from 'js/contextStateMgmtService';
import occMgmtServiceManager from 'js/occurrenceManagementServiceManager';
import occmgmtUtils from 'js/occmgmtUtils';

var exports = {};
export let urlParamsMap = {
    rootQueryParamKey: 'uid',
    selectionQueryParamKey: 'c_uid',
    openStructureQueryParamKey: 'o_uid',
    productContextQueryParamKey: 'pci_uid',
    csidQueryParamKey: 'c_csid',
    secondaryPageIdQueryParamKey: 'spageId',
    topElementQueryParamKey: 't_uid',
    pageIdQueryParamKey: 'pageId',
    recipeParamKey: 'recipe',
    subsetFilterParamKey: 'filter',
    contextOverride: 'incontext_uid'
};

var shortURLParams = [ 'rootQueryParamKey', 'productContextQueryParamKey', 'selectionQueryParamKey', 'openStructureQueryParamKey', 'topElementQueryParamKey', 'secondaryPageIdQueryParamKey',
    'contextOverride'
];

export let updateState = function( subPanelcontext, sublocInitialization ) {
    var newState = {
        pageId: 'tc_xrt_Content'
    };
    var isStateChanged = false;
    var previousState = subPanelcontext.occContext.previousState;

    if( appCtxSvc.ctx.splitView ) {
        var urlParamMapForCurrentContext = subPanelcontext.provider.urlParams;
        _.forEach( AwStateService.instance.params, function( value, parameter ) {
            if( _.values( urlParamMapForCurrentContext ).indexOf( parameter ) > -1 ) {
                var queryParam = _.invert( urlParamMapForCurrentContext )[ parameter ];
                var currentStateParam = urlParamsMap[ queryParam ];

                if( shortURLParams.includes( queryParam ) && value ) {
                    newState[ currentStateParam ] = value;
                } else if( subPanelcontext.occContext.currentState[ currentStateParam ] ) {
                    newState[ currentStateParam ] = subPanelcontext.occContext.currentState[ currentStateParam ];
                }

                isStateChanged = isStateChanged ? true : ( AwStateService.instance.params[ parameter ] || previousState[ currentStateParam ] ) &&
                    AwStateService.instance.params[ parameter ] !== previousState[ currentStateParam ];
            }
        } );
    } else {
        _.forEach( AwStateService.instance.params, function( value, name ) {
            if( AwStateService.instance.params[ name ] ) {
                newState[ name ] = value;
            }
        } );
        isStateChanged = _.keys( AwStateService.instance.params ).filter( function( key ) {
            return ( AwStateService.instance.params[ key ] || previousState[ key ] ) &&
                AwStateService.instance.params[ key ] !== previousState[ key ];
        } ).length !== 0;
    }

    var value = {};
    // On exiting the split view from inactive view, the expanded nodes have to be updated
    if( appCtxSvc.ctx.expandedNodes && subPanelcontext.occContext.transientRequestPref && _.isEmpty( subPanelcontext.occContext.transientRequestPref.expandedNodes ) ) {
        value.transientRequestPref = {
            expandedNodes: appCtxSvc.ctx.expandedNodes.map( ( { stableId } ) => stableId )
        };
    }

    if( sublocInitialization ) {
        if( appCtxSvc.ctx.preferences.AWC_BACKGROUND_PROPERTY_CALLS && appCtxSvc.ctx.preferences.AWC_BACKGROUND_PROPERTY_CALLS[ 0 ] && appCtxSvc.ctx.preferences.AWC_BACKGROUND_PROPERTY_CALLS[ 0 ].toUpperCase() === 'FALSE' ) {
            value.LoadTreePropsTimerDebug = 'false';
        }
        if( appCtxSvc.ctx.preferences.AWC_BACKGROUND_EXPANDBELOW_CALLS && appCtxSvc.ctx.preferences.AWC_BACKGROUND_EXPANDBELOW_CALLS[ 0 ] && appCtxSvc.ctx.preferences.AWC_BACKGROUND_EXPANDBELOW_CALLS[ 0 ].toUpperCase() === 'FALSE' ) {
            value.ExpandBelowDebug = 'false';
        }
    }

    if( isStateChanged && _.isEqual( newState.pageId, 'tc_xrt_Content' ) ) {
        if( !_.isEmpty( subPanelcontext.occContext.currentState.uid ) && newState.uid !== subPanelcontext.occContext.currentState.uid ) {
            let currentState = { ...subPanelcontext.occContext.currentState };
            let mergedState = _.assign( {}, currentState, newState );
            value.currentState = mergedState;
        } else if( !_.isEqual( newState, subPanelcontext.occContext.currentState ) ) {
            // 1. In case of selection change in PWA, AwDataNavigator performs URL update.
            // 2. After URL update, AwDataNavigator syncs occContext's currentState with newState URL params
            // 3. Next, baseLocationService detects and fires locationChangeSuccess event as URL params got changed.
            // 4. That in turn triggers occmgmtSublocation component update, i.e., current API call.
            // 5. So by the time control comes here in case of selection change, occContext has already been synced with newState.
            // 6. Above if check is added to update context state only if newState and occContext currentState does NOT match.
            // This reduces unnecessary rendering of AwDataNavigator
            let state = ctxStateMgmtService.createContextState( subPanelcontext.occContext, newState, true );
            value.currentState = state.currentState;
            value.previousState = state.previousState;

            if ( !sublocInitialization ) {
                occmgmtUtils.updateValueOnCtxOrState( '', value, subPanelcontext.occContext.viewKey );
            }
        }
    }


    if( !_.isEmpty( value ) ) {
        occmgmtUtils.updateValueOnCtxOrState( '', value, subPanelcontext.occContext );
    }

    return value;
};

var isURLUpdateToAddNewURLParameterInContentTabUrl = function() {
    var isUrlParamUpdate = false;
    _.forEach( AwStateService.instance.params, function( value, name ) {
        if( !_.isEqual( name, 'uid' ) && !_.isEqual( name, 'page' ) && !_.isEqual( name, 'pageId' ) && !_.isUndefined( value ) && !_.isNull( value ) && !isUrlParamUpdate ) {
            isUrlParamUpdate = true;
        }
    } );
    return isUrlParamUpdate;
};

var unsetReferencesRecursively = function( Object, isFirstLevelObject ) {
    for ( let key in Object ) {
        if( typeof Object[key] === 'object' && isFirstLevelObject ) {
            unsetReferencesRecursively( Object[key], false );
        } else{
            Object[key] = null;
        }
    }
};

export let updateUrlFromCurrentState = function( provider, currentState, replaceLocation  ) {
    var paramsToNavigate = { ...AwStateService.instance.params };
    if( appCtxSvc.ctx.splitView ) {
        _.forEach( currentState, function( value, parameter ) {
            if( _.values( urlParamsMap ).indexOf( parameter ) > -1 ) {
                var queryParam = _.invert( urlParamsMap )[ parameter ];
                if( shortURLParams.includes( queryParam ) ) {
                    paramsToNavigate[ provider.urlParams[ queryParam ] ] = value;
                } else if( paramsToNavigate[ provider.urlParams[ queryParam ] ] ) {
                    paramsToNavigate[ provider.urlParams[ queryParam ] ] = null;
                }
            }
        } );
    } else {
        _.forEach( currentState, function( value, name ) {
            paramsToNavigate[ name ] = value;
        } );
    }

    paramsToNavigate.edit = undefined;
    if( isURLUpdateToAddNewURLParameterInContentTabUrl() && replaceLocation !== false ) {
        AwStateService.instance.go( AwStateService.instance.current.name, paramsToNavigate, { location: 'replace' } );
    } else {
        AwStateService.instance.go( AwStateService.instance.current.name, paramsToNavigate );
    }
};

let registerContext = function( contextKey, provider, value, baseSelection ) {
    let sublocationVal = {
        clientScopeURI: provider.clientScopeURI,
        defaultClientScopeURI: provider.clientScopeURI
    };
    // we are setting columnsToExclude parameters on context
    // specific feature/application can set this for visibility of specific columns until
    // support from framework is available.
    let columnsToExclude = [ 'Awb0ConditionalElement.awb0PendingAction', 'Awb0PositionedElement.pma1UpdateAction', 'Awb0DesignElement.pma1LastAlignedPart',
        'Awb0DesignElement.REF(pma1LastAlignedPart,ItemRevision).release_status_list',
        'Awb0PartElement.pma1LastAlignedDesign', 'Awb0PartElement.REF(pma1LastAlignedDesign,ItemRevision).release_status_list', 'Awb0ConditionalElement.awb0MarkupType'
    ];
    let contextVal = {
        currentState: value.currentState,
        previousState: value.previousState,
        pwaSelectionModel: {},
        requestPref: provider.requestPref,
        transientRequestPref: {},
        persistentRequestPref: {
            showExplodedLines: false
        },
        expansionCriteria: {},
        urlParams: provider.urlParams,
        modelObject: baseSelection,
        /*
         *For Now commenting below isMarkupModeEnable as it causing regression for MarkupMode not
         *remain in markup mode after refresh : LCS-820510
         */
        //isMarkupEnabled: false,
        treeLoadingInProgress: true,
        sublocation: sublocationVal,
        columnsToExclude: columnsToExclude
    };

    if( appCtxSvc.ctx.splitView ) {
        if( appCtxSvc.ctx.splitView.resetTreeExpansionState && appCtxSvc.ctx.splitView.resetTreeExpansionState[ contextKey ] ) {
            contextVal.resetTreeExpansionState = true;
            delete appCtxSvc.ctx.splitView.resetTreeExpansionState[ contextKey ];
        }
    } else if( appCtxSvc.ctx.resetTreeExpansionState ) {
        contextVal.resetTreeExpansionState = true;
        appCtxSvc.unRegisterCtx( 'resetTreeExpansionState' );
    }

    appCtxSvc.registerCtx( contextKey, contextVal );

    appCtxSvc.registerCtx( 'aceActiveContext', {
        key: contextKey,
        context: appCtxSvc.ctx[ contextKey ]
    } );
};

export let initializeOccmgmtSublocation = function( subPanelContext ) {
    const contextKey = subPanelContext.provider.contextKey;
    const useAutoBookmark = subPanelContext.provider.useAutoBookmark;
    let value = updateState( subPanelContext, true );

    registerContext( contextKey, subPanelContext.provider, value, subPanelContext.baseSelection );

    occMgmtServiceManager.initializeOccMgmtServices( contextKey, useAutoBookmark );
};

export let destroyOccmgmtSublocation = function( data, subPanelContext ) {
    appCtxSvc.unRegisterCtx( 'searchResponseInfo' );

    let currentContext = appCtxSvc.getCtx( subPanelContext.provider.contextKey );

    // Fix for LCS-852827
    // All the functions from occmgmtContext needs to be deference otherwise the garbage collector will not able to clean the memory from the heap.
    unsetReferencesRecursively( currentContext.vmc, true );
    unsetReferencesRecursively( currentContext.treeDataProvider, true );
    occmgmtUtils.updateValueOnCtxOrState( '', currentContext, subPanelContext.provider.contextKey );

    occMgmtServiceManager.destroyOccMgmtServices( subPanelContext );
    appCtxSvc.unRegisterCtx( subPanelContext.provider.contextKey );

    if( !appCtxSvc.ctx.splitView ) {
        appCtxSvc.unRegisterCtx( 'aceActiveContext' );
    }

    // Remove the reference for dispatch when destroying the sublocation
    let occmgmtContextValue = { ...subPanelContext.occContext.getValue() };
    occmgmtContextValue.updateOccContextStateOnTree = null;

    occmgmtUtils.updateValueOnCtxOrState( '', occmgmtContextValue, subPanelContext.occContext );
};

export default exports = {
    initializeOccmgmtSublocation,
    destroyOccmgmtSublocation,
    updateUrlFromCurrentState,
    updateState,
    urlParamsMap
};
