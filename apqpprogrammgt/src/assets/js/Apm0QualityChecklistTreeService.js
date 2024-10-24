// Copyright (c) 2022 Siemens

/**
 * @module js/Apm0QualityChecklistTreeService
 */
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import awTableStateService from 'js/awTableStateService';
import soaSvc from 'soa/kernel/soaService';
import uwPropertySvc from 'js/uwPropertyService';
import awColumnSvc from 'js/awColumnService';
import awTableSvc from 'js/awTableService';
import iconSvc from 'js/iconService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import cdm from 'soa/kernel/clientDataModel';
import tableSvc from 'js/published/splmTablePublishedService';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import _ from 'lodash';
import parsingUtils from 'js/parsingUtils';
import dms from 'soa/dataManagementService';
import Apm0ChecklistTreeService from 'js/Apm0ChecklistTreeService';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';



var exports = {};



/**
  * Resolve the row data for the 'next' page of 'children' nodes of the given 'parent'.
  * <P>
  * Note: The paging status is maintained in the 'parent' node.
  *
  * @param {DeferredResolution} deferred -
  * @param {TreeLoadInput} treeLoadInput -
  * @return {Promise} Revolved with a TreeLoadResult object containing result/status information.
  */
function _loadTreeTableRows( treeLoadInput, sortCriteria, panelContext ) {
    /**
      * Check if this 'parent' is NOT known to be a 'leaf' and has no 'children' yet.
      */
    var deferred = AwPromiseService.instance.defer();
    var parentNode = treeLoadInput.parentNode;

    if ( !parentNode.isLeaf ) {
        var soaInput = {
            columnConfigInput: {
                clientName: 'AWClient',
                clientScopeURI: 'Psi0AbsChecklistURI'
            },
            saveColumnConfigData: {
                clientScopeURI: '',
                columnConfigId: '',
                scope: '',
                scopeName: ''
            },
            searchInput: {
                maxToLoad: 1000,
                maxToReturn: 1000,
                providerName: 'Awp0ObjectSetRowProvider',
                searchCriteria: {
                    objectSet: 'apm0QualityChecklistList.Apm0QualityChecklist'
                },
                startIndex: treeLoadInput.startChildNdx,
                searchSortCriteria: sortCriteria
            }
        };       
        var policyJson = {
            types: [
                {
                    name: 'Apm0QualityChecklist',
                    properties: [
                        {
                            name: 'apm0QualityChecklistList'
                        },
                        {
                            name: 'apm0ParentChecklist'
                        },
                        {
                            name: 'object_desc'
                        },
                        {
                            name: 'release_status_list'
                        },
                        {
                            name: 'apm0AssessmentRequired'
                        },
                        {
                            name: 'apm0Number'
                        }
                    ]
                },
                {
                    name: 'Awp0XRTObjectSetRow',
                    properties: [
                        {
                            name: 'awp0Target'
                        }
                    ]
                }
            ]
        };
        var isLoadAllEnabled = true;
        var children = []; 

        if ( parentNode.levelNdx < 0 ) {           
        // the props seperately.
            soaInput.searchInput.searchCriteria.parentUid = panelContext.baseSelection.uid;
            
            var policyId = propertyPolicySvc.register( policyJson );
            soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then(
                function( response ) {
                    if ( policyId ) {
                        propertyPolicySvc.unregister( policyId );
                    }
                    var puid = cdm.getObject( panelContext.baseSelection.uid );
                    if(puid){
                        children.push(puid);
                    }
                    else if ( response.searchResultsJSON ) {
                        var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
                        if ( searchResults ) {
                            for ( var x = 0; x < searchResults.objects.length; ++x ) {
                                var uid = searchResults.objects[x].uid;
                                var obj = response.ServiceData.modelObjects[uid];
                                var underlyingObject = cdm.getObject( obj.props.awp0Target.dbValues[0] );                               
                                if(underlyingObject){
                                    children.push( underlyingObject );
                                }
            }
                        }
                    } 
                    var treeLoadResult = Apm0ChecklistTreeService.getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, response.columnConfig.columns );
                    treeLoadResult.columnConfig = response.columnConfig;
                    deferred.resolve( {
                        treeLoadResult: treeLoadResult
                    } );                        
                } );
        } else {
            if ( parentNode.props.apm0QualityChecklistList.dbValues.length === 0 ) {
                parentNode.isLeaf = true;
                var endReached = true;
                var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, children, false, true,
                    endReached, null );
                deferred.resolve( {
                    treeLoadResult: treeLoadResult
                } );
            }
            else
            {
                soaInput.searchInput.searchCriteria.parentUid = parentNode.uid;
            var policyId = propertyPolicySvc.register( policyJson );
                soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then(
                function( response ) {
                    if ( policyId ) {
                        propertyPolicySvc.unregister( policyId );
                    }
                    if ( response.searchResultsJSON ) {
                        var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
                        if ( searchResults ) {
                            for ( var x = 0; x < searchResults.objects.length; ++x ) {
                                var uid = searchResults.objects[x].uid;
                                var obj = response.ServiceData.modelObjects[uid];
                                var underlyingObject = cdm.getObject( obj.props.awp0Target.dbValues[0] );
                                if ( underlyingObject ) {
                                    children.push( underlyingObject );
                                }
                            }
                        }
                    }
                        var treeLoadResult = Apm0ChecklistTreeService.getTreeLoadResult( parentNode, children, isLoadAllEnabled, treeLoadInput, response.columnConfig.columns );


                        treeLoadResult.columnConfig = response.columnConfig;
                            deferred.resolve( {
                                treeLoadResult: treeLoadResult
                            } );
                            } );
                        }
                    }
    }
    return deferred.promise;
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
  *     delayTimeTree: {Number}
  * }
  * </pre>
  *
  * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
  *         available.
  */
export let loadTreeTableData = function(treeLoadInput, searchSortCriteria, subPanelContext) {  
 
    if( treeLoadInput ) {
        treeLoadInput.displayMode = 'Tree';
        return _loadTreeTableRows( treeLoadInput,  searchSortCriteria, subPanelContext );
        
    }
};


/**
  * This makes sure, edited object is selected
  * @param {data} data
  * @param {ArrayList} selectionModel selection model of pwa
  */
export let processPWASelection = function( data, selectionModel,subPanelContext ) {
    if (appCtxService.ctx.qualityChecklistManagerContext)
    {
        var selectedModelObject = appCtxService.ctx.qualityChecklistManagerContext.selectedNodes;
        var viewModelCollection = data.dataProviders.qualityChecklistTreeDataProvider.viewModelCollection;
        if ( selectedModelObject && selectedModelObject.length > 0 ) {
            _.forEach( selectedModelObject, function( selectedObject ) {
                if ( viewModelCollection.loadedVMObjects.length > 0 ) {
                    selectionModel.setSelection( selectedObject );
                    var parentIdx = _.findLastIndex( viewModelCollection.loadedVMObjects, function( vmo ) {
                        return vmo.uid === selectedObject.props.qc0ParentChecklistSpec.dbValues[0];
                    } );
                    if ( parentIdx > -1 ) {
                        var parentVMO = viewModelCollection.getViewModelObject( parentIdx );
                        addNodeToExpansionState( parentVMO, data );
                    }
                }
            } );
        } else if ( !selectedModelObject || selectedModelObject && selectedModelObject.length === 0 ) {
            selectionModel.setSelection( [] );
        }
    }
    else
    {
        selectionModel.setSelection( subPanelContext.baseSelection );
    }
};

/**
  * Add local storage entry corresponding to the information sent in.
  *
  * @param node This parameter can either be the node that is to be added to local storage or it can be just the id
  *            of the node
  * @param declViewModel The declarative view model backing this tree
  */
export let addNodeToExpansionState = function( node, declViewModel ) {
    // For now we will use id of the grid that is first in the list of grids in the view model.
    // Once we get this value in treeLoadInput we will shift to using it.
    var gridId = Object.keys( declViewModel.grids )[0];
    awTableStateService.saveRowExpanded( declViewModel, gridId, node );
};

/**
  * Update selected nodes in context based on pin value
  * selected node set as new object if panel pinned is true
  * selected node set as current selection if panel pinned is false
  * @param {DeclViewModel} data
  */
export let selectNewlyAddedElement = function( data, subPanelContext ) {
    appCtxService.ctx.qualityChecklistManagerContext = {};
    appCtxService.ctx.qualityChecklistManagerContext.selectedNodes = [];
    if ( subPanelContext && !subPanelContext.panelPinned ) {
        appCtxService.ctx.qualityChecklistManagerContext.selectedNodes = data.selectedNodes;
    } else {
        if ( appCtxService.ctx.selected ) {
            appCtxService.ctx.qualityChecklistManagerContext.selectedNodes.push( appCtxService.ctx.selected );
        }
    }
};

export default exports = {
    loadTreeTableData,
    processPWASelection,
    selectNewlyAddedElement,
    addNodeToExpansionState
};

