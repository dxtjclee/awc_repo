// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/projectTreeTableService
 */
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import awTableSvc from 'js/awTableService';
import iconSvc from 'js/iconService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import awColumnService from 'js/awColumnService';
import parammgmtUtilSvc from 'js/Att1ParameterMgmtUtilService';
import tcVmoService from 'js/tcViewModelObjectService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import parsingUtils from 'js/parsingUtils';
import AwStateService from 'js/awStateService';
import localeService from 'js/localeService';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';

var exports = {};

var _proxyObjects = null;
const _projectRefreshCompletedEvent = 'Att1RefreshProject.completed';
export let updateDisplayNames = function( eventData ) {
    if( eventData.vmc ) {
        _.forEach( eventData.modifiedObjects, function( mo ) {
            _.forEach( eventData.vmc.loadedVMObjects, function( vmo ) {
                var owningObject = parammgmtUtilSvc.getOwningObjectFromParamProxy( vmo );
                //Update the display name
                if( owningObject && owningObject.uid === mo.uid && mo.props && mo.props.object_name ) {
                    var newDisplayName = mo.props.object_name.uiValues[ 0 ];
                    if( vmo.displayName !== newDisplayName ) {
                        vmo.displayName = newDisplayName;
                    }
                }
            } );
        } );
    }
    return false;
};
export let refreshOrExpandTree = function( data ) {
    if( data.dataProviders && data.dataProviders.gridDataProvider ) {
        var treeDataProvider = data.dataProviders.gridDataProvider;
        var selectedNodes = treeDataProvider.selectedObjects;
        if( selectedNodes && selectedNodes.length > 0 && !data.eventData.isResetPWA ) {
            if( data.eventData.isCutParamFromPWA ) {
                refreshWhenCutFromPWA( selectedNodes );
            } else {
                var nodesToExpand = [];
                var isExapansionRequired = true;
                for( var i = 0; i < selectedNodes.length; i++ ) {
                    var targetTreeNode = selectedNodes[ i ];
                    if( data.eventData.expandParent ) {
                        targetTreeNode = targetTreeNode.parentNode;
                    }
                    nodesToExpand.push( targetTreeNode );
                    if( targetTreeNode === treeDataProvider.topTreeNode ) {
                        eventBus.publish( 'primaryWorkarea.reset' );
                        isExapansionRequired = false;
                        break;
                    }
                    if( targetTreeNode.isExpanded === undefined || targetTreeNode.isExpanded ) {
                        targetTreeNode.isExpanded = false;
                        eventBus.publish( 'gridView.plTable.toggleTreeNode', targetTreeNode );
                    }
                }
                if( isExapansionRequired ) {
                    expandAllNodes( nodesToExpand );
                }
            }
        } else {
            //addition of group at root level need to reset Primary workArea any Other Solution??
            eventBus.publish( 'primaryWorkarea.reset' );
        }
        if( data.eventData.refreshParamTable ) {
            // TODO: there are lots of operations that repeat to load the uniform parameters table.
            // Need to update these operations before uncomment the below line.
            // eventBus.publish( 'uniformParamTable.reloadTable' );
        }

        _checkAndSelectCreatedNode( data, treeDataProvider.selectionModel );
    }
};
var _checkAndSelectCreatedNode = function( data, selectionModel ) {
    if( !data.eventData.isPinnedFlag && data.eventData.createdObjects && data.eventData.createdObjects.length > 0 ) {
        var createdObjects = data.eventData.createdObjects;
        var treeNodeUpdatedEventSubscriber = eventBus.subscribe( 'gridView.plTable.loadProps', function( eventData ) {
            if( eventData.VMOs ) {
                for( var i = 0; i < eventData.VMOs.length; i++ ) {
                    if( eventData.VMOs[ i ].uid.indexOf( createdObjects[ 0 ].uid ) !== -1 ) {
                        var createdObject = eventData.VMOs[ i ];
                        eventBus.unsubscribe( treeNodeUpdatedEventSubscriber );
                        selectionModel.setSelection( createdObject );
                        return;
                    }
                }
            }
        } );
    }
};

var refreshWhenCutFromPWA = function( selectedNodes ) {
    // find parent of selected Nodes
    var parentNodes = [];
    for( var i = 0; i < selectedNodes.length; i++ ) {
        parentNodes.push( selectedNodes[ i ].parentNode );
    }
    var targetTreeNodes = [];
    //remove duplicate parents from list
    for( var x = 0; x < parentNodes.length; x++ ) {
        var tempNodeList = _.find( targetTreeNodes, function( node ) {
            return parentNodes[ x ].id === node.id;
        } );
        if( tempNodeList === undefined ) {
            targetTreeNodes.push( parentNodes[ x ] );
        }
    }
    _.defer( function() {
        // targetTreeNodes contains nodes we want to expand.
        for( var x = 0; x < targetTreeNodes.length; x++ ) {
            if( targetTreeNodes[ x ].isExpanded === undefined || targetTreeNodes[ x ].isExpanded ) {
                targetTreeNodes[ x ].isExpanded = false;
                eventBus.publish( 'gridView.plTable.toggleTreeNode', targetTreeNodes[ x ] );
            }
        }
        expandAllNodes( targetTreeNodes );
    } );
};

/**
 * Method to expand given tree nodes
 * @param {TreeNode} nodesToExpand the tree nodes to expand
 */
function expandAllNodes( nodesToExpand ) {
    setTimeout( () => {
        for( var x = 0; x < nodesToExpand.length; x++ ) {
            eventBus.publish( 'gridDataProvider.expandTreeNode', { parentNode: nodesToExpand[ x ] } );
        }
    }, 200 );
}

/**
 * @param {Object} uwDataProvider - An Object (usually a UwDataProvider) on the DeclViewModel on the $scope this
 *            action function is invoked from.
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 *
 * <pre>
 * {
 *     columnInfos : {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 * }
 * </pre>
 */
export let loadTreeTableColumns = function( uwDataProvider ) {
    var deferred = AwPromiseService.instance.defer();
    var awColumnInfos = [];
    localeService.getLocalizedText( 'Att1Messages', 'Name' ).then( function( result ) {
        awColumnInfos.push( awColumnService.createColumnInfo( {
            name: 'object_name',
            displayName: result,
            typeName: 'Att1AttributeAlignmentProxy',
            width: 400,
            enableColumnResizing: true,
            enableColumnMoving: false,
            isTreeNavigation: true
        } ) );
    } );

    uwDataProvider.columnConfig = {
        columns: awColumnInfos
    };

    deferred.resolve( {
        columnInfos: awColumnInfos
    } );
    return deferred.promise;
};

/**
 *
 * @param {Object} propertyLoadInput input
 * @returns{Object} propertyLoadResult property load result
 */
function _loadProperties( propertyLoadInput ) {
    var allChildNodes = [];
    var propertyLoadContext = {
        clientName: 'AWClient',
        clientScopeURI: 'Att1ProjectNavigation'
    };

    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props ) {
                childNode.props = {};
            }

            allChildNodes.push( childNode );
        } );
    } );

    var propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( allChildNodes );

    return tcVmoService.getTableViewModelProperties( allChildNodes, propertyLoadContext ).then(
        function( response ) {
            _.forEach( allChildNodes, function( childNode ) {
                var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm
                    .getObject( childNode.id ), 'EDIT' );
                _.forEach( vmo.props, function( vmProp ) {
                    childNode.props[ vmProp.propertyName ] = vmProp;
                    var propColumns = response.output.columnConfig.columns;
                    updateTypeNamePropInColConfig( propColumns );
                } );
                if( childNode.props.att1SourceAttribute ) {
                    var srcObject = cdm.getObject( childNode.props.att1SourceAttribute.dbValues[ 0 ] );
                    if( srcObject.modelType.typeHierarchyArray.indexOf( 'Att0ParamGroup' ) > -1 && srcObject.props.att0ChildParamValues.dbValues[ 0 ] === undefined && srcObject.props
                        .att0ChildParamGroups.dbValues[ 0 ] === undefined ) {
                        childNode.isLeaf = true;
                    }
                }
            } );
            if( response ) {
                propertyLoadResult.columnConfig = response.output.columnConfig;
            }
            propertyLoadResult.columnConfig.columns[ 0 ].pixelWidth = 400;
            //update viewModelProperties
            return {
                propertyLoadResult: propertyLoadResult
            };
        } );
}

/**
 * Update type name property in column config
 * @param {*} propColumns column config
 */
function updateTypeNamePropInColConfig( propColumns ) {
    _.forEach( propColumns, function( col ) {
        if( !col.typeName && col.associatedTypeName ) {
            col.typeName = col.associatedTypeName;
        }
    } );
}

/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {PropertyLoadRequestArray} propertyLoadRequests - An array of PropertyLoadRequest objects this action
 *            function is invoked from. The object is usually the result of processing the 'inputData' property
 *            of a DeclAction based on data from the current DeclViewModel on the $scope) . The 'pageSize'
 *            properties on this object is used (if defined).
 * @returns {Promise} promise
 *
 */
export let loadTreeTableProperties = function() { // eslint-disable-line no-unused-vars
    /**
     * Extract action parameters from the arguments to this function.
     */
    var propertyLoadInput = awTableSvc.findPropertyLoadInput( arguments );

    if( propertyLoadInput ) {
        return _loadProperties( propertyLoadInput );
    }

    return AwPromiseService.instance.reject( 'Missing PropertyLoadInput parameter' );
};

/**
 * @param {Object} obj - Object sent by server
 * @param {childNdx} childNdx Child Index
 * @param {levelNdx} levelNdx Level Index
 * @param {parentNode} parentNode Parent node
 * @return {ViewModelTreeNode} View Model Tree Node
 */
function createVMNodeUsingObjectInfo( obj, childNdx, levelNdx, parentNode ) {
    var displayName;
    var objUid = obj.uid;
    var objType = obj.type;
    var hasChildren = containChildren( cdm.getObject( obj.props.att1SourceAttribute.dbValues[ 0 ] ) );
    if( obj.props && obj.props.object_string ) {
        displayName = obj.props.object_string.uiValues[ 0 ];
    }
    // get Icon for node
    var srcObject = cdm.getObject( obj.props.att1SourceAttribute.dbValues[ 0 ] );
    var iconURL = evaluateIconUrlForNode( srcObject.type, obj );

    // Update the display name as source object's name
    if( srcObject.props && srcObject.props.object_name ) {
        displayName = srcObject.props.object_name.uiValues[ 0 ];
    }

    var vmNode = awTableTreeSvc
        .createViewModelTreeNode( objUid, objType, displayName, levelNdx, childNdx, iconURL );

    vmNode.isLeaf = !hasChildren;
    //TODO - this one causing recursive assignment of parent node. so commenting temp
    //vmNode.parentNode = parentNode;
    return vmNode;
}

/**
 * function to evaluate if an object contains children
 * @param {objectType} object object
 * @return {boolean} if node contains child
 */
function containChildren( object ) {
    if( object.modelType.typeHierarchyArray.indexOf( 'Att0ParamGroup' ) > -1 ) {
        return true;
    }
    return false;
}

/**
 * function to evaluate the icon URL
 * @param {objType} objType object type
 * @param {object} obj object
 * @return {iconURL} iconURL
 */
function evaluateIconUrlForNode( objType, obj ) {
    var iconURL = null;
    if( objType ) {
        iconURL = iconSvc.getTypeIconURL( objType );
    }
    return iconURL;
}

function getOpenedObjectUid() {
    var openedObjectUid = '';
    var stateSvc = AwStateService.instance;
    if( stateSvc && stateSvc.params ) {
        var params = stateSvc.params;
        if( params.uid ) {
            openedObjectUid = params.uid;
        }
    }
    return openedObjectUid;
}

/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {TreeLoadInput} treeLoadInput - An Object this action function is invoked from. The object is usually
 *            the result of processing the 'inputData' property of a DeclAction based on data from the current
 *            DeclViewModel on the $scope) . The 'pageSize' properties on this object is used (if defined).
 *
 * <pre>
 * {
 * Extra 'debug' Properties
 *     dbg_isLoadAllEnabled: {Boolean}
 *     dbg_pageDelay: {Number}
 * }
 * </pre>
 *
 * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
 *         available.
 */
export let loadTreeTableData = function( treeLoadInput, sortCriteria, columnFilters, subPanelContext ) {
    /**
     * Check the validity of the parameters
     */
    var deferred = AwPromiseService.instance.defer();


    /**
     * Get the 'child' nodes async
     */
    _buildTreeTableStructure( treeLoadInput.parentNode, deferred, treeLoadInput, sortCriteria, columnFilters, subPanelContext );

    return deferred.promise;
};
/**
 * @param {ViewModelTreeNode} parentNode - A node that acts as 'parent' of a hierarchy of 'child'
 *            ViewModelTreeNodes.
 * @param {DeferredResolution} deferred - Resolved with a resulting TreeLoadResult object.
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @return {TreeLoadResult} A new TreeLoadResult object containing result/status information.
 *
 */
function _buildTreeTableStructure( parentNode, deferred, treeLoadInput, sortCriteria, columnFilters, subPanelContext ) {
    treeLoadInput.parentElement = parentNode.levelNdx === -1 ? 'AAAAAAAAAAAAAA' : parentNode.id;
    treeLoadInput.displayMode = 'Tree';
    var soaInput = _prepareSoaInputForTreeLoad( sortCriteria, parentNode, treeLoadInput, columnFilters, subPanelContext );
    return soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then(
        function( response ) {
            _proxyObjects = [];
            if( response.searchResultsJSON ) {
                var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
                if( searchResults ) {
                    for( var x = 0; x < searchResults.objects.length; ++x ) {
                        var uid = searchResults.objects[ x ].uid;
                        var obj = response.ServiceData.modelObjects[ uid ];
                        if( obj ) {
                            _proxyObjects.push( obj );
                        }
                    }
                }
            }
            var endReachedVar = response.totalLoaded + treeLoadInput.startChildNdx === response.totalFound;
            var startReachedVar = true;

            var tempCursorObject = {
                endReached: endReachedVar,
                startReached: true
            };
            var treeLoadResult = processProviderResponse( treeLoadInput, _proxyObjects, startReachedVar, endReachedVar );
            treeLoadResult.parentNode.cursorObject = tempCursorObject;
            var activeRevisionRule = subPanelContext.subPanelHeaderData.activeRevisionRule;
            var activeVariantRule = subPanelContext.subPanelHeaderData.activeVariantRule;
            _manageRuleChange( deferred, treeLoadResult, activeRevisionRule, activeVariantRule );
        },
        function( error ) {
            deferred.reject( error );
        } );
}

var _prepareSoaInputForTreeLoad = function( sortCriteria, parentNode, treeLoadInput, columnFilters, subPanelContext ) {
    var fieldName = '';
    var sortDirection = '';

    if( sortCriteria && sortCriteria.length > 0 ) {
        fieldName = sortCriteria[ 0 ].fieldName;
        sortDirection = sortCriteria[ 0 ].sortDirection;
    }
    var search = appCtxSvc.getCtx( 'search' );
    var noVariantRule = 'false';
    var activeRevisionRuleUID;
    var activeVariantRuleUID;
    //get RevisionRule
    var activeRevisionRule = subPanelContext.subPanelHeaderData.activeRevisionRule;
    if( activeRevisionRule ) {
        activeRevisionRuleUID = activeRevisionRule;
    } else {
        var revisionRuleObj = parammgmtUtilSvc.getRequiredPropValueFromConfigurationContext( 'revision_rule', subPanelContext.baseSelection );
        if( revisionRuleObj ) {
            activeRevisionRuleUID = revisionRuleObj.dbValues[ 0 ];
        }
    }
    //getVariant Rule
    var activeVariantRule = subPanelContext.subPanelHeaderData.activeVariantRule;
    if( activeVariantRule ) {
        activeVariantRuleUID = activeVariantRule;
    }
    if( activeVariantRuleUID ) {
        if( activeVariantRuleUID === 'SR:NO_VARIANT_RULE' ) {
            noVariantRule = 'true';
        }
    } else {
        var savedVariantRule = parammgmtUtilSvc.getRequiredPropValueFromConfigurationContext( 'variant_rule', subPanelContext.baseSelection );
        if( savedVariantRule && savedVariantRule.dbValues[ 0 ] !== '' ) {
            activeVariantRuleUID = savedVariantRule.dbValues[ 0 ];
        }
    }
    // Get opened Object Uid
    //(In case of VR , opened object uid needed to set in every parameter and to get the Project from crt0Domain to display Project Tree structure )
    var _openedObjectUid = getOpenedObjectUid();
    var openedObj = cdm.getObject( _openedObjectUid );
    if( openedObj && openedObj.modelType.typeHierarchyArray.indexOf( 'Crt0ContractRevision' ) > -1 && openedObj.uid === parentNode.uid ) {
        parentNode.uid = openedObj.props.crt0Domain.dbValues[ 0 ];
    }

    var configPerspective = _.get( appCtxSvc, 'ctx.parammgmtctx.configPerspective.uid', undefined );
    var sublocation = appCtxSvc.getCtx( 'sublocation' );
    //return soaInput
    return {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: sublocation.clientScopeURI
        },
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: search.provider,
            searchSortCriteria: [ {
                fieldName: fieldName,
                sortDirection: sortDirection
            } ],
            searchCriteria: {
                parentUid: parentNode.uid,
                svrUid: activeVariantRuleUID,
                openedObjectUid: _openedObjectUid,
                configPerspective: configPerspective,
                noVariantRule: noVariantRule,
                revisionRuleUid: activeRevisionRuleUID,
                dcpSortByDataProvider: 'true'
            },
            startIndex: treeLoadInput.startChildNdx,
            columnFilters: columnFilters
        }
    };
};
/**
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {ISOAResponse} searchResults - SOA Response
 * @param {startReached} startReached - start Reached
 * @param {endReached} endReached - end Reached
 * @return {TreeLoadResult} A new TreeLoadResult object containing result/status information.
 */
function processProviderResponse( treeLoadInput, searchResults, startReached, endReached ) {
    // This is the "root" node of the tree or the node that was selected for expansion
    var parentNode = treeLoadInput.parentNode;

    var levelNdx = parentNode.levelNdx + 1;

    var vmNodes = [];
    // treeNodes contains values of folders we want to expand as a
    // result of the Node Checkout and Add to child branch operation.
    // Information is in the SOA service data
    var treeNodes = appCtxSvc.getCtx( 'checkedOutCreatedNodes' );

    for( var childNdx = 0; childNdx < searchResults.length; childNdx++ ) {
        var object = searchResults[ childNdx ];
        var vmNode = createVMNodeUsingObjectInfo( object, childNdx, levelNdx, parentNode );

        checkForFoldersToExpand( treeNodes, vmNode );

        if( vmNode ) {
            vmNodes.push( vmNode );
        }
    }

    parentNode.isLeaf = searchResults.length === 0;

    // Third Paramter is for a simple vs ??? tree
    return awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, startReached, endReached, null );
}

// This function will check the check out node SOA response values to
// determine if there are any new folders to expand in the tree
var checkForFoldersToExpand = function( treeNodes, vmNode ) {
    if( treeNodes ) {
        for( var x = 0; x < treeNodes.length; x++ ) {
            // check if a folder is in the service data returned from the CO SOA response
            if( treeNodes[ x ] === vmNode.uid ) {
                // Store node we want to expand, and store in array
                // that we will process after tree loads
                // Once we save the tree node, clean up the ctx value so that
                // the processed value does not get processed again and keeps
                // the ctx value correct
                treeNodes.splice( x, 1 );
                // Once all the nodes are processed, delete ctx value
                if( treeNodes.length === 0 ) {
                    appCtxSvc.unRegisterCtx( 'checkedOutCreatedNodes' );
                } else {
                    appCtxSvc.registerCtx( 'checkedOutCreatedNodes', treeNodes );
                }
            }
        }
    }
};

var _manageRuleChange = function( deferred, treeLoadResult, activeRevisionRule, activeVariantRule ) {
    //check if call is made from revision rule selection change or variant rule Change
    if( activeRevisionRule || activeVariantRule ) {
        var refreshProjectSubscriber = eventBus.subscribe( _projectRefreshCompletedEvent, function() {
            deferred.resolve( {
                treeLoadResult: treeLoadResult
            } );
            eventBus.unsubscribe( refreshProjectSubscriber );
            refreshProjectSubscriber = undefined;
        } );
        //again reinitialize ui properties in revision or variant rule widget
        if( activeRevisionRule ) {
            eventBus.publish( 'Att1RuleChange.RefreshProject', { activeRevisionRuleObj: cdm.getObject( activeRevisionRule ) } );
            //check if call is made from Variant rule selection change
        } else if( activeVariantRule ) {
            var activeVariantRuleObj = cdm.getObject( activeVariantRule );
            if( activeVariantRule === 'SR:NO_VARIANT_RULE' ) {
                activeVariantRuleObj = { noVariantRule: true };
            }
            eventBus.publish( 'Att1RuleChange.RefreshProject', { activeVariantRuleObj: activeVariantRuleObj } );
        }
    } else {
        deferred.resolve( {
            treeLoadResult: treeLoadResult
        } );
    }
};

export let handelRefreshProject = function( data ) {
    var activeRevisionRuleObj = data.eventMap[ 'Att1RuleChange.RefreshProject' ].activeRevisionRuleObj;
    var activeVariantRuleObj = data.eventMap[ 'Att1RuleChange.RefreshProject' ].activeVariantRuleObj;
    var _openedObjectUid = getOpenedObjectUid();
    var openedObject = cdm.getObject( _openedObjectUid );
    if( activeRevisionRuleObj ) {
        var currRevisionRule = parammgmtUtilSvc.getRequiredPropValueFromConfigurationContext( 'revision_rule', openedObject );
        eventBus.publish( _projectRefreshCompletedEvent, { activeRevisionRuleObj: activeRevisionRuleObj } );
    } else if( activeVariantRuleObj ) {
        var currVariantRule = parammgmtUtilSvc.getRequiredPropValueFromConfigurationContext( 'variant_rule', openedObject );
        if( currVariantRule ) {
            var appliedVariantRule = parammgmtUtilSvc.createViewModelProperty( currVariantRule );
            eventBus.publish( _projectRefreshCompletedEvent, { activeVariantRuleObj: appliedVariantRule } );
        }
    }
};

/**
 * This method will get called when parameterState will implement
 * @param {*} selectedObjects
 * @param {*} openedObject
 * @param {*} parameterState
 */
export const syncParamSelections = ( selectedObjects, openedObject, parameterState = {} ) => {
    var newParameterState = { ...parameterState.value };

    newParameterState.selectedParameters = [];
    newParameterState.selectedGroups = [];
    newParameterState.mselected = [];
    newParameterState.selectedProxyParams = [];
    newParameterState.selectedProxyGroups = [];
    //update selected object in parameterState
    if( selectedObjects && selectedObjects.length > 0 ) {
        // get the selected attributes
        for( var idx = 0; idx < selectedObjects.length; ++idx ) {
            var selected = parammgmtUtilSvc.getOwningObjectFromParamProxy( selectedObjects[ idx ] );
            if( selected ) {
                if( selected.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1 ) {
                    newParameterState.selectedProxyParams.push( selectedObjects[ idx ] );
                    newParameterState.selectedParameters.push( selected );
                } else if( selected.modelType.typeHierarchyArray.indexOf( 'Att0ParamGroup' ) > -1 ) {
                    newParameterState.selectedProxyGroups.push( selectedObjects[ idx ] );
                    newParameterState.selectedGroups.push( selected );
                    if( selected.props && selected.props.att0ChildParamGroups && selected.props.att0ChildParamValues && selected.props.att0ChildParamGroups.dbValues.length === 0 && selected.props
                        .att0ChildParamValues.dbValues.length === 0 ) {
                        newParameterState.selectedLeafGroups.push( selected );
                    }
                }
                newParameterState.mselected.push( selected );
            } else {
                newParameterState.mselected.push( selectedObjects );
            }
        }
    } else {
        //if nothing is selected then set opened object in mselected
        newParameterState.mselected.push( openedObject );
    }
    newParameterState.hasVariantConfigContext = parammgmtUtilSvc.isVariantConfigurationContextAttached( openedObject );

    for( var idx = 0; idx < selectedObjects.length; ++idx ) {
        if( selectedObjects[ idx ].props.checked_out && selectedObjects[ idx ].props.checked_out.dbValues[ 0 ] === ' ' ) {
            appCtxSvc.registerCtx( 'canCheckoutProxyObjects', true );
            break;
        }
        if( selectedObjects[ idx ].props.checked_out && selectedObjects[ idx ].props.checked_out.dbValues[ 0 ] === 'Y' ) {
            appCtxSvc.registerCtx( 'canCheckinProxyObjects', true );
            break;
        }
    }

    parameterState.update && parameterState.update( newParameterState );
};

/**
 * Initalize parameterstate with default value. this will get used when we implement parametetrState
 * @param {*} baseSelection
 * @param {*} parameterState
 */
export let initializeParameterState = function( openedObject ) {
    var openedProject = parammgmtUtilSvc.getOpenedParamProject( openedObject );
    var hasVariantConfigContext = parammgmtUtilSvc.isVariantConfigurationContextAttached( openedObject );
    var newParameterState = {
        parameterProject: openedObject,
        selectedParameters: [],
        selectedGroups: [],
        selectedLeafGroups: [],
        mselected: [ openedObject ],
        hasVariantConfigContext: false,
        selectedParentsAreModifiable: true,
        parameterSelectedInPramProjectContext: false,
        selectedProxyParams: [],
        selectedProxyGroups: [],
        showParametersOnVC: false,
        showFSC: false,
        activeRevisionRule: '',
        activeVariantRule: '',
        swaSelectedObjects: []
    };
    parammgmtUtilSvc.resetParentAccess();
    return { ...newParameterState };
};

/**
 * method to update SWA selection in parameter state
 * @param {*} eventData
 * @param {*} parameterState
 */
export let handleParameterSelectionChange = function( eventData, parameterState ) {
    //In case of legacy project update selected objects in parametersState
    if( parameterState && eventData.selectedProxyParams ) {
        let localParametersState = { ...parameterState.value };
        localParametersState.swaSelectedObjects = eventData.selectedProxyParams;
        parameterState.update( localParametersState );
    }
};

/**
 * projectTreeTableService factory
 */
export default exports = {
    updateDisplayNames,
    refreshOrExpandTree,
    loadTreeTableColumns,
    loadTreeTableProperties,
    loadTreeTableData,
    syncParamSelections,
    handelRefreshProject,
    initializeParameterState,
    handleParameterSelectionChange
};
