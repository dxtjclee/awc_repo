// Copyright (c) 2022 Siemens

/**
 * @module js/Att1ConfigureVariantForProductService
 */
import eventBus from 'js/eventBus';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import policySvc from 'soa/kernel/propertyPolicyService';
import AwPromiseService from 'js/awPromiseService';
import soaService from 'soa/kernel/soaService';
import parsingUtils from 'js/parsingUtils';
import attrTableUtils from 'js/attrTableUtils';
import paramgmgtUtilSvc from 'js/Att1ParameterMgmtUtilService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import occmgmtBackingObjectProviderSvc from 'js/occmgmtBackingObjectProviderService';

var exports = {};
var _selectionChangeListener = null;
var _variantRuleChangeListener = null;
var _variantGridContentLoadedListener = null;
var _variantGridContentUnloadedListener = null;
var isPlatformAtLeastTc133 = false;
var selectionChangedToTopNode = function( selectedObjects ) {
    var isTopNodeSelected = false;
    var viewMode = _.get( appCtxSvc, 'ctx.ViewModeContext.ViewModeContext', undefined );
    if( viewMode === 'TreeSummaryView' && selectedObjects.length === 1 && selectedObjects[ 0 ].levelNdx === 0 ) {
        isTopNodeSelected = true;
    }
    return isTopNodeSelected;
};
var subscribeContentLoadedForVariantGrid = function( commandContext ) {
    var selectShowParameters = commandContext.subPanelContext.context.occContext.persistentRequestPref.showParametersOnVC;
    if( !_variantGridContentLoadedListener && selectShowParameters ) {
        _variantGridContentLoadedListener = eventBus.subscribe( 'configuratorVcaTable.gridLoaded', function() {
            if( selectShowParameters ) {
                _setContext( appCtxSvc, 'variantConditionContext.allowConsumerAppsToLoadData', true );
                _setContext( appCtxSvc, 'variantConditionContext.consumerAppsLoadDataInProgress', true );
                let commandContextTemp = { ...commandContext.subPanelContext.context.occContext.getValue() };
                commandContextTemp.persistentRequestPref.showParametersOnVC = selectShowParameters;
                commandContext.subPanelContext.context.occContext.update( commandContextTemp );
                exports.loadParameterVariants( _.get( appCtxSvc, 'ctx.occmgmtContext.selectedModelObjects', [] ), false );
            }
        } );
    }
};

var subscribePWASelectionChange = function( showParametersOnVC ) {
    if( !_selectionChangeListener && showParametersOnVC ) {
        _selectionChangeListener = eventBus.subscribe( 'primaryWorkArea.selectionChangeEvent', function( eventData ) {
            if( eventData && eventData.selectedObjects && eventData.selectedObjects.length > 0 ) {
                //checkIf TopElementIsSelected only
                if( !selectionChangedToTopNode( eventData.selectedObjects ) ) {
                    if( showParametersOnVC ) {
                        exports.loadParameterVariants( eventData.selectedObjects, true );
                    }
                }
            }
        } );
    }
};
var subscribeVariantRuleChange = function( showParametersOnVC, commandContextParent  ) {
    if( showParametersOnVC ) {
        _variantRuleChangeListener = eventBus.subscribe( 'productContextChangedEvent', function( eventData ) {
            let occCtx = commandContextParent.subPanelContext.context.occContext.getValue();
            var selectedParent = cdm.getObject( occCtx.pwaSelection[0].uid );
            var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( selectedParent, 'EDIT' );
            var  selectedObjects = [ vmo ];
            if( eventData  ) {
                //checkIf TopElementIsSelected only
                if( !selectionChangedToTopNode( selectedObjects ) ) {
                    if( showParametersOnVC ) {
                        exports.loadParameterVariants( selectedObjects, true );
                    }
                }
            }
        } );
    }
};
var actionsToPerformWhenVariantGridUnloaded = function( commandContext ) {
    if( !isPlatformAtLeastTc133 ) {
        _setContext( appCtxSvc, 'variantConditionContext.allowConsumerAppsToLoadData', undefined );
    }
    if( commandContext && commandContext.subPanelContext && commandContext.subPanelContext.context ) {
        let commandContextTemp = { ...commandContext.subPanelContext.context.occContext.getValue() };
        commandContextTemp.persistentRequestPref.showParametersOnVC = undefined;
        commandContext.subPanelContext.context.occContext.update( commandContextTemp );
    }
    hideParameterVariants();
};

var subscribeContentUnLoadedForVariantGrid = function( commandContext ) {
    if( commandContext && commandContext.subPanelContext.context.occContext.persistentRequestPref.showParametersOnVC && !_variantGridContentUnloadedListener ) {
        _variantGridContentUnloadedListener = eventBus.subscribe( 'occmgmtContext.tabSetUnregistered', function( ) {
            var subLocation = _.get( appCtxSvc, 'ctx.locationContext.ActiveWorkspace:SubLocation', undefined );
            if( subLocation !== 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation' ) {
                actionsToPerformWhenVariantGridUnloaded( commandContext );
            }
        } );
    }
};

var unSubscribeContentUnLoadedForVariantGrid = function() {
    if( _variantGridContentUnloadedListener ) {
        eventBus.unsubscribe( _variantGridContentUnloadedListener );
        _variantGridContentUnloadedListener = undefined;
    }
};
var unSubscribePWASelectionChange = function() {
    if( _selectionChangeListener ) {
        eventBus.unsubscribe( _selectionChangeListener );
        _selectionChangeListener = undefined;
    }
};
var unSubscribeVariantRuleChange = function() {
    if( _variantRuleChangeListener ) {
        eventBus.unsubscribe( _variantRuleChangeListener );
        _variantRuleChangeListener = undefined;
    }
};
var unSubscribeContentLoadedForVariantGrid = function() {
    if( _variantGridContentLoadedListener ) {
        eventBus.unsubscribe( _variantGridContentLoadedListener );
        _variantGridContentLoadedListener = undefined;
        _setContext( appCtxSvc, 'variantConditionContext.consumerAppsLoadDataInProgress', undefined );
    }
};
export let loadParameterVariants = function( selectedObjects, isSelectionChange ) {
    var deferred = AwPromiseService.instance.defer();
    var promise = exports.showParameters( selectedObjects, isSelectionChange );
    promise.then( function( response ) {
        deferred.resolve( response );
    } ).catch( function( error ) {
        deferred.reject( error );
    } );
    deferred.promise;
};

var getPerformSearchViewModel5Input = function( parentUids, createParamVarConf ) {
    var productContextUids = _.get( appCtxSvc, 'ctx.occmgmtContext.productContextInfo.uid', '' );
    var isVariantConditionTabActive = createParamVarConf;

    var openedObjectUid = attrTableUtils.getOpenedObjectUid();
    var openedObject = cdm.getObject( openedObjectUid );
    if( openedObject && openedObject.modelType.typeHierarchyArray.indexOf( 'Crt0VldnContractRevision' ) > -1 ) {
        openedObjectUid = _.get( appCtxSvc, 'ctx.occmgmtContext.productContextInfo.props.awb0Product.dbValues[0]', undefined );
    }

    return {
        inflateProperties: false,
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: 'ShowAttrProxyTableForDCP_TC122'
        },
        searchInput: {
            maxToLoad: 5000,
            maxToReturn: 5000,
            providerName: 'Att1ShowParametersProvider',
            searchCriteria: {
                openedObjectUid: openedObjectUid,
                parentUids: parentUids,
                productContextUids: productContextUids,
                createVariantConfigObjects: isVariantConditionTabActive,
                dcpSortByDataProvider: 'true',
                separator: '^$~'
            },
            searchSortCriteria: [ {
                fieldName: '',
                sortDirection: 'ASC'
            } ],
            startIndex: 0
        }
    };
};

var registerPolicy = function() {
    return policySvc.register( {
        types: [ {
            name: 'Att1AttributeAlignmentProxy',
            properties: [ {
                name: 'att1SourceAttribute',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            }, {
                name: 'att1HasChildren'
            }, {
                name: 'att1SourceElement'
            } ]
        } ]
    } );
};

/**
 * updates the context with given key and value.
 * @param {_appCtxSvc} _appCtxSvc app context.
 * @param {keyContext} keyContext key.
 * @param {value} value value.
 */
function _setContext( _appCtxSvc, keyContext, value ) {
    _appCtxSvc.updateCtx( keyContext, value );
}

export let toggleShowParameters = function( commandContext ) {
    var showParametersOnVC = commandContext.subPanelContext.context.occContext.persistentRequestPref.showParametersOnVC;
    let commandContextTemp = { ...commandContext.subPanelContext.context.occContext.getValue() };
    isPlatformAtLeastTc133 = paramgmgtUtilSvc.isPlatformVersionAtleast( 13, 3 );
    if( !showParametersOnVC ) {
        _setContext( appCtxSvc, 'variantConditionContext.allowConsumerAppsToLoadData', true );
        //this ctx variable to store status for Paramgmt since variant condition get reset when we leave variant views
        commandContextTemp.persistentRequestPref.showParametersOnVC = true;

        subscribeContentLoadedForVariantGrid( commandContext );
        subscribePWASelectionChange( true );
        subscribeVariantRuleChange( true, commandContext  );
        subscribeContentUnLoadedForVariantGrid( commandContext );
    } else {
        commandContextTemp.persistentRequestPref.showParametersOnVC = undefined;
        let parammgmtctx = _.get( appCtxSvc, 'ctx.parammgmtctx', undefined );
        if( !_.isUndefined( parammgmtctx ) && !_.isUndefined( parammgmtctx.selectedObjectsFromConsumerApps ) && isPlatformAtLeastTc133 ) {
            _setContext( appCtxSvc, 'variantConditionContext.selectedObjectsFromConsumerApps', parammgmtctx.selectedObjectsFromConsumerApps );
        } else {
            _setContext( appCtxSvc, 'variantConditionContext.allowConsumerAppsToLoadData', undefined );
        }

        unSubscribeContentLoadedForVariantGrid();
        unSubscribePWASelectionChange();
        unSubscribeVariantRuleChange();
        unSubscribeContentUnLoadedForVariantGrid();
    }
    commandContext.subPanelContext.context.occContext.update( commandContextTemp );
};

export let showParameters = function( selectedObjects, isSelectionChange ) {
    var deferred = AwPromiseService.instance.defer();
    var policyId = registerPolicy();
    var parentUids = paramgmgtUtilSvc.getParentUids( selectedObjects, '^$~' );
    var promise = soaService.post( 'Internal-AWS2-2023-06-Finder',
        'performSearchViewModel5', getPerformSearchViewModel5Input( parentUids, 'true' ) );

    promise.then( function( response ) {
        exports.updateVcaContext( response, selectedObjects, isSelectionChange );
        policySvc.unregister( policyId );
        deferred.resolve( response );
    } ).catch( function( error ) {
        deferred.reject( error );
    } );
    return deferred.promise;
};

var updateCtxAndReloadVCTable = function( proxyAttrs, variantParameterMap, isSelectionChange ) {
    _setContext( appCtxSvc, 'variantConditionContext.selectedObjectsFromConsumerApps', proxyAttrs );
    _setContext( appCtxSvc, 'parammgmtctx.variantParameterMap', variantParameterMap );

    var consumerAppsLoadDataInProgress = _.get( appCtxSvc, 'ctx.variantConditionContext.consumerAppsLoadDataInProgress', undefined );
    if( consumerAppsLoadDataInProgress ) {
        _setContext( appCtxSvc, 'variantConditionContext.consumerAppsLoadDataInProgress', undefined );
    }
    //reload the variantGrid on Selection Change
    var variantFormulaIsDirty = _.get( appCtxSvc, 'ctx.variantConditionContext.variantFormulaIsDirty' );
    if( isSelectionChange && !appCtxSvc.ctx.isVariantTableEditing && !variantFormulaIsDirty ) {
        eventBus.publish( 'configuratorVcaTable.reload' );
    }
};

export let updateVcaContext = function( response, selectedObjects, isSelectionChange ) {
    if( response.searchResultsJSON ) {
        var proxyAttrs = [];
        var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
        var variantParameterMap = new Map();
        //populate Map with only selected objects from PWA
        _.forEach( selectedObjects, function( element ) {
            variantParameterMap.set( element.uid, [] );
        } );
        if( searchResults && searchResults.objects.length > 0 ) {
            //now add parameters from soa Response
            for( var x = 0; x < searchResults.objects.length; ++x ) {
                var proxyParameter = cdm.getObject( searchResults.objects[ x ].uid );
                var sourceElementId = proxyParameter.props.att1SourceElement.dbValues[ 0 ];
                if( sourceElementId ) {
                    var parameterList = variantParameterMap.get( sourceElementId ) || [];
                    parameterList.push( proxyParameter );
                    variantParameterMap.set( sourceElementId, parameterList );
                }
            }
        }

        if( isPlatformAtLeastTc133 ) {
            var selectedElements = [];
            let selectedObjectsKeys = Array.from( variantParameterMap.keys() );
            for( var x1 = 0; x1 < selectedObjectsKeys.length; ++x1 ) {
                var element = cdm.getObject( selectedObjectsKeys[ x1 ] );
                selectedElements.push( element );
            }
            //As part of LCS-625085, instead of elements, pass bom lines to input.
            var backingObjsChildObjsResponse = occmgmtBackingObjectProviderSvc.getBackingObjects( selectedElements );
            backingObjsChildObjsResponse.then( function( backingObjects ) {
                var elementToBomLineMap = new Map();
                for( var i = 0; i < backingObjects.length; i++ ) {
                    elementToBomLineMap.set( selectedObjectsKeys[ i ], backingObjects[ i ] );
                }

                for( const [ sourceElementId, parameters ] of variantParameterMap.entries() ) {
                    proxyAttrs.push( elementToBomLineMap.get( sourceElementId ) );
                    proxyAttrs = proxyAttrs.concat( parameters );
                }

                //Ctx needed to load VC table with selected bom lines in PWA when show parameters is toggled OFF.
                _setContext( appCtxSvc, 'parammgmtctx.selectedObjectsFromConsumerApps', backingObjects );
                updateCtxAndReloadVCTable( proxyAttrs, variantParameterMap, isSelectionChange );
            } );
        } else {
            for( const [ sourceElementId, parameterList ] of variantParameterMap.entries() ) {
                var sourceElement = cdm.getObject( sourceElementId );
                proxyAttrs.push( sourceElement );
                proxyAttrs = proxyAttrs.concat( parameterList );
            }
            updateCtxAndReloadVCTable( proxyAttrs, variantParameterMap, isSelectionChange );
        }
    }
};
export let hideParameterVariants = function() {
    _setContext( appCtxSvc, 'parammgmtctx.variantParameterMap', undefined );

    if( !isPlatformAtLeastTc133 ) {
        _setContext( appCtxSvc, 'variantConditionContext.allowConsumerAppsToLoadData', undefined );
    }

    unSubscribePWASelectionChange();
    unSubscribeVariantRuleChange();
    unSubscribeContentLoadedForVariantGrid();
    unSubscribeContentUnLoadedForVariantGrid();
};

export default exports = {
    toggleShowParameters,
    showParameters,
    updateVcaContext,
    hideParameterVariants,
    loadParameterVariants
};
