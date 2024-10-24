// Copyright (c) 2022 Siemens

/**
 * This file is used as services file for Failure Specification structure edit for quality module
 *
 * @module js/Aqc0FailureSpecEditStructureServices
 */
import eventBus from 'js/eventBus';
import _ from 'lodash';
import AwPromiseService from 'js/awPromiseService';
import AwStateService from 'js/awStateService';
import appCtxService from 'js/appCtxService';
import aqc0FailureSpecTreeTableService from 'js/Aqc0FailureSpecTreeTableService';
import soaSvc from 'soa/kernel/soaService';
import policySvc from 'soa/kernel/propertyPolicyService';
import parsingUtils from 'js/parsingUtils';

var exports = {};

/**
 * @returns {String} the opened object UID
 */
function getOpenedObjectUid() {
    var openedObjectUid = '';
    var stateSvc = AwStateService.instance;
    if( stateSvc && stateSvc.params ) {
        var params = stateSvc.params;
        openedObjectUid = params.uid;
    }
    return openedObjectUid;
}

/**
 * Add newly added element to the tree and update the selection to this node.
 *@param {ModelObject} addElementInput Created object response from SOA
 */
export let addNewElement = function( subPanelContext, dataProvider ) {
    let searchState = subPanelContext.searchState ? subPanelContext.searchState : subPanelContext.pageContext.sublocationState;
    let addElementInput;
    if( searchState ) {
        addElementInput = searchState.newlyCreatedElement;
    }
    var updatedParentElement = addElementInput && addElementInput.props.qc0ParentFailure ? addElementInput.props.qc0ParentFailure.dbValues[ 0 ] : null;
    _insertAddedElementIntoVMOForSelectedParent( dataProvider, updatedParentElement, addElementInput, searchState )
        .then(
            function() {
                appCtxService.updatePartialCtx( 'search.totalFound', dataProvider.viewModelCollection.loadedVMObjects.length + 1 );

                var eventData = {
                    objectsToSelect: [ addElementInput ]
                };
                eventBus.publish( 'aqc0FailureSpecSelectionUpdateEvent', eventData );
            }
        );
};

/**
 * Inserts objects added under selected parent(contained in the addElementResponse) into the viewModelCollection
 *
 * @param {Object} viewModelCollection The view model collection to add the object into
 * @param {Object} ViewModelTreeNode Top tree node.
 * @param {Object} inputParentElement The input parent element on which addd is initiated.
 * @param {Object} newElements List of new elements to add
 *
 */
function _insertAddedElementIntoVMOForSelectedParent( dataProvider, inputParentElement,
    newElements, searchState ) {
    var deferred = AwPromiseService.instance.defer();
    var viewModelCollection = dataProvider.viewModelCollection;
    //First find if the parent exists in the viewModelCollection
    var parentIdx = _.findLastIndex( viewModelCollection.loadedVMObjects, function( vmo ) {
        return vmo.uid === inputParentElement;
    } );

    if( parentIdx > -1 ) {
        var parentVMO = viewModelCollection.getViewModelObject( parentIdx );
        // First add the children for selected parent node.
        if( parentVMO ) {
            _updateParentNodeState( deferred, dataProvider, parentVMO.uid, parentIdx, newElements, searchState ); //.then( function() {
        }
    } else {
        // Add root failure specification.
        _updateParentNodeState( deferred, dataProvider, null, parentIdx, newElements, searchState );
    }
    return deferred.promise;
}

/**
 * Inserts objects added (contained in the addElementResponse) into the viewModelCollection
 *
 * @param {Object} viewModelCollection The view model collection to add the object into
 * @param {Object} parentVMO (null if no parentVMO)
 * @param {Number} parentIdx - index of the parentVMO in the viewModelCollection (-1 if no parentVMO)
 * @param {Object} ModelObject List of model objects in SOA response
 * @param {Number} newChildIdx - index of the newchild in the SOA response (-1 if not found)
 * @param {Number} childOccRespIdx Index of new element in SOA response
 * @param {Object} childOccurrence - child occurrence to add
 * @param {ViewModelTreeNode} topTreeNode top tree node.
 */
function _insertSingleAddedElementIntoParentVMOAndViewModelCollection( dataProvider,
    parentVMO, children, newChildIdx, childOccRespIdx, childOccurrence, searchState ) {
    var viewModelCollection = dataProvider.viewModelCollection;
    var topTreeNode = dataProvider.topTreeNode;
    var childlevelIndex = 0;
    if( parentVMO ) {
        childlevelIndex = parentVMO.levelNdx + 1;
    }

    if( childOccRespIdx !== 0 ) {
        var elementBeforeNewEle = children[ childOccRespIdx - 1 ];

        var elementBeforeNewEleInVmoIdx = _.findLastIndex( viewModelCollection.loadedVMObjects, function( vmo ) {
            return vmo.uid === elementBeforeNewEle.uid;
        } );

        var elementBeforeNewEleVmo = _.find( viewModelCollection.loadedVMObjects, function( vmo ) {
            return vmo.uid === elementBeforeNewEle.uid;
        } );

        //Find the childIndex in the childOccurences (if we can)
        var childIdx = -1;
        if( newChildIdx > -1 ) {
            childIdx = newChildIdx;
        } else {
            childIdx = elementBeforeNewEleVmo ? elementBeforeNewEleVmo.childNdx + 1 : 1;
        }

        //corner case not in pagedChildOccs and has no length it is truly empty
        if( childIdx < 0 ) {
            childIdx = 0;
        }

        //Create the viewModelTreeNode from the child ModelObject, child index and level index
        var childVMO = aqc0FailureSpecTreeTableService.createVmNodeUsingNewObjectInfo( childOccurrence, childlevelIndex, childIdx, true, searchState );
        childVMO.selected = false;
        //Add the new treeNode to the parentVMO (if one exists) children array
        if( parentVMO ) {
            if( parentVMO.children ) {
                var elementBeforeNewChildExistingIdx = _.findLastIndex( parentVMO.children, function( child ) {
                    return child.uid === elementBeforeNewEle.uid;
                } );
                for( var i = elementBeforeNewChildExistingIdx + 1; i < parentVMO.children.length; i++ ) {
                    parentVMO.children[ i ].childNdx = parentVMO.children[ i ].childNdx + 1;
                }
                parentVMO.children.splice( elementBeforeNewChildExistingIdx + 1, 0, childVMO );
                parentVMO.isLeaf = false;
                parentVMO.totalChildCount = parentVMO.children.length;
            } else {
                parentVMO.children = [];
                parentVMO.children.push( childVMO );
                parentVMO.isLeaf = false;
                parentVMO.totalChildCount = parentVMO.children.length;
            }
        }
        // Add new treeNode to top tree node
        else {
            if( topTreeNode && topTreeNode.children ) {
                var elementBeforeNewChildExistingIdx = _.findLastIndex( topTreeNode.children, function( child ) {
                    return child.uid === elementBeforeNewEle.uid;
                } );
                for( var i = elementBeforeNewChildExistingIdx + 1; i < topTreeNode.children.length; i++ ) {
                    topTreeNode.children[ i ].childNdx = topTreeNode.children[ i ].childNdx + 1;
                }
                topTreeNode.children.splice( elementBeforeNewChildExistingIdx + 1, 0, childVMO );
                topTreeNode.totalChildCount = topTreeNode.children.length;
            }
        }

        if( viewModelCollection && viewModelCollection.loadedVMObjects ) {
            for( var i = elementBeforeNewEleInVmoIdx + 1; i < viewModelCollection.loadedVMObjects.length; i++ ) {
                if( viewModelCollection.loadedVMObjects[ i ] && viewModelCollection.loadedVMObjects[ elementBeforeNewEleInVmoIdx ]
                    && viewModelCollection.loadedVMObjects[ i ].levelNdx <= viewModelCollection.loadedVMObjects[ elementBeforeNewEleInVmoIdx ].levelNdx ) {
                    break;
                }
            }

            var newIndex = i;
            viewModelCollection.loadedVMObjects.splice( newIndex, 0, childVMO );
        }
    } else {
        //Find the childIndex in the childOccurences (if we can)
        var childIdx = -1;
        if( newChildIdx > -1 ) {
            childIdx = newChildIdx;
        } else {
            childIdx = 1;
        }

        //corner case not in pagedChildOccs and has no length it is truly empty
        if( childIdx < 0 ) {
            childIdx = 0;
        }

        //Create the viewModelTreeNode from the child ModelObject, child index and level index
        var childVMO = aqc0FailureSpecTreeTableService.createVmNodeUsingNewObjectInfo( childOccurrence, childlevelIndex, childIdx, true, searchState );

        if( parentVMO ) {
            var newIndex = _.findLastIndex( viewModelCollection.loadedVMObjects, function( vmo ) {
                return vmo.uid === parentVMO.uid;
            } );

            viewModelCollection.loadedVMObjects.splice( newIndex + 1, 0, childVMO );
        } else {
            viewModelCollection.loadedVMObjects.push( childVMO );
        }
    }
    dataProvider.update( viewModelCollection.loadedVMObjects );
}

/**
 * Update parentVMO state ( mark as expanded=true, isLeaf=false)
 * @param deferred
 * @param {Object} viewModelCollection The view model collection to add the object into
 * @param {String} parentUid parent uid
 * @param {Number} parent index in current tree view model
 * @param {ModelObject} newElements new object that is to be inserted in tree
 * @param {ViewModelTreeNode} topTreeNode top tree node.
 */
function _updateParentNodeState( deferred, dataProvider, parentUid, parentIdx, newElements, searchState ) {
    //Now get the exact viewModelTreeNode for the parent Occ in the viewModelCollection
    var viewModelCollection = dataProvider.viewModelCollection;
    var topTreeNode = dataProvider.topTreeNode;
    var policyId = policySvc.register( {
        types: [ {
            name: 'Qc0Failure',
            properties: [ {
                name: 'qc0FailureList'
            } ]
        } ]
    } );
    var soaInput2 = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: ''
        },
        searchInput: {
            maxToLoad: 110,
            maxToReturn: 110,
            providerName: 'Aqc0QualityBaseProvider',
            searchFilterMap6: {
                'WorkspaceObject.object_type': [ {
                    searchFilterType: 'StringFilter',
                    stringValue: 'Qc0Failure'
                } ]
            },
            searchCriteria: {
                parentGUID: '',
                searchStatus: ( !searchState.showInactive ).toString(),
                catalogueObjectType: ''
            },
            startIndex: 0,
            searchSortCriteria: []
        }
    };
    if( parentIdx > -1 ) {
        var parentVMO = viewModelCollection.getViewModelObject( parentIdx );

        if( parentVMO ) {
            //the parent exists in the VMO lets make sure it is now marked as parent and expanded
            soaInput2.searchInput.searchCriteria.parentGUID = parentUid;
            soaInput2.searchInput.maxToLoad = parentVMO.children && parentVMO.children.length > soaInput2.searchInput.maxToLoad ? parentVMO.children.length : soaInput2.searchInput.maxToLoad;
            soaInput2.searchInput.maxToReturn = parentVMO.children && parentVMO.children.length > soaInput2.searchInput.maxToLoad ? parentVMO.children.length : soaInput2.searchInput.maxToReturn;
            soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput2 ).then(
                function( response ) {
                    var children = [];
                    if( response.searchResultsJSON ) {
                        var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
                        if( searchResults ) {
                            for( var x = 0; x < searchResults.objects.length; ++x ) {
                                var uid = searchResults.objects[ x ].uid;
                                var obj = response.ServiceData.modelObjects[ uid ];
                                if( obj ) {
                                    children.push( obj );
                                }
                            }
                        }
                    }

                    if( policyId ) {
                        policySvc.unregister( policyId );
                    }

                    if( children && children.length > 0 ) {
                        if( parentVMO.isLeaf === true ||  !parentVMO.isLeaf && !parentVMO.isExpanded ) {
                            // If a tree node doesn't have any child i.e. it is a leaf node OR if a node has children but it is in collapsed state
                            // then below code is executed. Used for loop for creating nodes for all objects present in children array
                            for( let j = 0; j < children.length; j++ ) {
                                _insertSingleAddedElementIntoParentVMOAndViewModelCollection( dataProvider,
                                    parentVMO, children, -1, j, children[ j ], searchState, parentVMO );
                            }
                            parentVMO.expanded = true;
                            parentVMO.isExpanded = true;
                            parentVMO.isLeaf = false;
                            deferred.resolve();
                        } else {
                            // If a tree node has children and its expanded then below code gets executed
                            parentVMO.expanded = true;
                            parentVMO.isExpanded = true;
                            parentVMO.isLeaf = false;
                            if( children.length > 0 ) {
                                var newlyAddedEleInResponseIdx = _.findLastIndex( children, function( child ) {
                                    return child.uid === newElements.uid;
                                } );

                                if( newlyAddedEleInResponseIdx > -1 ) {
                                    _insertSingleAddedElementIntoParentVMOAndViewModelCollection( dataProvider,
                                        parentVMO, children, -1, newlyAddedEleInResponseIdx, children[ newlyAddedEleInResponseIdx ], searchState );
                                    deferred.resolve();
                                } else {
                                    deferred.resolve();
                                }
                            }
                        }
                    } else {
                        deferred.resolve();
                    }
                } );
        }
    } else {
        soaInput2.searchInput.searchCriteria.catalogueObjectType = 'Qc0Failure';
        var targetNode = getOpenedObjectUid();
        if( targetNode ) {
            soaInput2.searchInput.searchCriteria.parentGUID = targetNode;
        }
        soaInput2.searchInput.maxToLoad = topTreeNode.children && topTreeNode.children.length > soaInput2.searchInput.maxToLoad ? topTreeNode.children.length : soaInput2.searchInput.maxToLoad;
        soaInput2.searchInput.maxToReturn = topTreeNode.children && topTreeNode.children.length > soaInput2.searchInput.maxToLoad ? topTreeNode.children.length : soaInput2.searchInput.maxToReturn;
        soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput2 ).then(
            function( response ) {
                var children = [];
                if( response.searchResultsJSON ) {
                    var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
                    if( searchResults ) {
                        for( var x = 0; x < searchResults.objects.length; ++x ) {
                            var uid = searchResults.objects[ x ].uid;
                            var obj = response.ServiceData.modelObjects[ uid ];
                            if( obj ) {
                                children.push( obj );
                            }
                        }
                    }
                }

                if( policyId ) {
                    policySvc.unregister( policyId );
                }
                if( children.length > 0 ) {
                    var newlyAddedEleInResponseIdx = _.findLastIndex( children, function( child ) {
                        return child.uid === newElements.uid;
                    } );

                    if( newlyAddedEleInResponseIdx > -1 ) {
                        _insertSingleAddedElementIntoParentVMOAndViewModelCollection( dataProvider,
                            null, children, -1, newlyAddedEleInResponseIdx, children[ newlyAddedEleInResponseIdx ], searchState );

                        deferred.resolve();
                    } else {
                        deferred.resolve();
                    }
                }
            } );
    }
    return deferred.promise;
}

/**
 * Update Failure Specification tree after any specification is editted by info panel or RH toobar edit summary command
 * @param {*} dataProvider
 * @param {*} subPanelContext
 * @param {*} selectedObject - specification object which was editted
 * @param {*} selectionModel
 */
export let updateSpecTreeAfterEdit = function( dataProvider, subPanelContext, selectedObject, selectionModel ) {
    // isShowInactive gives filter information whether active filter is applied or not
    let isShowInactive = false;
    if(subPanelContext && subPanelContext.searchState && subPanelContext.searchState.showInactive){
        isShowInactive =  subPanelContext.searchState.showInactive;
    }else if(subPanelContext && subPanelContext.pageContext && subPanelContext.pageContext.sublocationState && subPanelContext.pageContext.sublocationState.showInactive){
        isShowInactive =  subPanelContext.pageContext.sublocationState.showInactive;
    }
    let isSpecActive = Boolean( selectedObject && selectedObject.props.qc0Status && selectedObject.props.qc0Status.dbValues &&
                       selectedObject.props.qc0Status.dbValues[0] === '1' );
    let loadedVMObjects = dataProvider.viewModelCollection.loadedVMObjects;
    let edittedSpecNodeIndex = loadedVMObjects.findIndex( ( vmo ) => vmo.uid === selectedObject.uid );

    if ( edittedSpecNodeIndex > -1 ) {
        if( isSpecActive ) {
            // If the specification is active after edit
            if ( isShowInactive ) {
                // and filter is set for showing inactive and active both types of specs then make spec node properly visible
                loadedVMObjects[edittedSpecNodeIndex].visible = true;
                dataProvider.update( loadedVMObjects );
            }
        } else {
            // If the specification is inactive after edit
            if ( isShowInactive ) {
                // and filter is set for showing inactive and active both types of specs then fade out the spec node

                let edittedSpecNode = loadedVMObjects[edittedSpecNodeIndex];
                if( edittedSpecNode ) {
                    edittedSpecNode.visible = false;
                    // If editted inactive spec node has children specs also then along with editted spec node, also fade out all
                    // child nodes present down the hierarchy
                    for( let i = edittedSpecNodeIndex + 1; i < loadedVMObjects.length; i++ ) {
                        if ( loadedVMObjects[i].levelNdx <= edittedSpecNode.levelNdx ) {
                            break;
                        } else {
                            if( loadedVMObjects[i].visible !== false ) {
                                loadedVMObjects[i].visible = false;
                            }
                        }
                    }
                    dataProvider.update( loadedVMObjects );
                }
            } else {
                // and filter is set for showing only active specs then remove the spec node

                // get the parentNode uid and its all childs count
                let parentNodeUid = loadedVMObjects[edittedSpecNodeIndex] && loadedVMObjects[edittedSpecNodeIndex].props.qfm0ParentTag ?
                    loadedVMObjects[edittedSpecNodeIndex].props.qfm0ParentTag.dbValues[0] : '';
                let parentNodeIndex;
                if( parentNodeUid ) {
                    parentNodeIndex = loadedVMObjects.findIndex( ( vmo )=> vmo.uid === parentNodeUid );

                    let allChildNodes = loadedVMObjects.filter( ( vmo )=>{
                        if( vmo && vmo.props.qfm0ParentTag && vmo.props.qfm0ParentTag.dbValues[0] === parentNodeUid ) {
                            return vmo;
                        }
                    } );

                    if( parentNodeIndex > -1 && loadedVMObjects[parentNodeIndex] ) {
                        // Update parentNode properties as one of its child has been removed from tree
                        if( allChildNodes.length === 1 ) {
                            loadedVMObjects[parentNodeIndex].isLeaf = true;
                            loadedVMObjects[parentNodeIndex].isExpanded = false;
                            loadedVMObjects[parentNodeIndex].children = [];
                            loadedVMObjects[parentNodeIndex].totalChildCount = 0;
                        } else {
                            if( loadedVMObjects[parentNodeIndex].children && loadedVMObjects[parentNodeIndex].children.length > 0 ) {
                                let childToBeRemovedIndex = loadedVMObjects[parentNodeIndex].children.findIndex( ( childVmo ) => childVmo.uid === selectedObject.uid );
                                loadedVMObjects[parentNodeIndex].children.splice( childToBeRemovedIndex, 1 );
                            }
                            loadedVMObjects[parentNodeIndex].totalChildCount--;
                        }
                    }
                }

                // remove the editted spec node
                let edittedSpecNode = loadedVMObjects[edittedSpecNodeIndex];
                if( edittedSpecNode ) {
                    if( edittedSpecNode.isLeaf === true ) {
                        // If editted inactive spec node has no children specs then only remove the editted spec node
                        loadedVMObjects.splice( edittedSpecNodeIndex, 1 );
                    } else {
                        // If editted inactive spec node has children specs then along with editted spec node, also remove all
                        // child nodes present down the hierarchy
                        let childNodesToBeRemovedCount = 0;
                        for( let i = edittedSpecNodeIndex + 1; i < loadedVMObjects.length; i++ ) {
                            if ( loadedVMObjects[i].levelNdx <= edittedSpecNode.levelNdx ) {
                                break;
                            } else {
                                childNodesToBeRemovedCount++;
                            }
                        }
                        loadedVMObjects.splice( edittedSpecNodeIndex, childNodesToBeRemovedCount + 1 );
                    }
                }

                dataProvider.update( loadedVMObjects );

                // clear selection as the selected nodes itself has been removed
                selectionModel.setSelection( [] );
            }
        }
    }
};

export default exports = {
    addNewElement,
    updateSpecTreeAfterEdit
};
