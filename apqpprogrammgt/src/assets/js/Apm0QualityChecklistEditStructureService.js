// Copyright (c) 2022 Siemens

/**
 * This file is used as services file for Checklist Specification structure edit for quality module
 *
 * @module js/Apm0QualityChecklistEditStructureService
 */
import eventBus from 'js/eventBus';
import _ from 'lodash';
import AwPromiseService from 'js/awPromiseService';
import appCtxService from 'js/appCtxService';
import Apm0ChecklistTreeService from 'js/Apm0ChecklistTreeService';
import soaSvc from 'soa/kernel/soaService';
import policySvc from 'soa/kernel/propertyPolicyService';
import parsingUtils from 'js/parsingUtils';
import dms from 'soa/dataManagementService';
import cdm from 'soa/kernel/clientDataModel';

var exports = {};

/**
  * Add newly added element to the tree and update the selection to this node.
  *@param {ModelObject} addElementInput Created object response from SOA
  */
export let addNewElement = function( addElementInput, dataProvider, sortCriteria, pinFlag ) {
    dms.getProperties( [ addElementInput.uid ], [ 'apm0ParentChecklist' ] ).then( function() {
        var updatedParentElement = addElementInput && addElementInput.props.apm0ParentChecklist ? addElementInput.props.apm0ParentChecklist.dbValues[ 0 ] : null;
        _insertAddedElementIntoVMOForSelectedParent( dataProvider, updatedParentElement, addElementInput, sortCriteria ).then( function() {
            appCtxService.updatePartialCtx( 'search.totalFound', dataProvider.viewModelCollection.loadedVMObjects.length + 1 );
            var eventData = {
                objectsToSelect: [ addElementInput ],
                pinUnpinFlag: pinFlag
            };
            eventBus.publish( 'apm0.updateSelectionInPWA', eventData );
        } );
    } );
};

/**
  * Inserts objects added under selected parent(contained in the addElementResponse) into the viewModelCollection
  *
  * @param {Object} viewModelCollection The view model collection to add the object into
  * @param {Object} ViewModelTreeNode Top tree node.
  * @param {Object} inputParentElement The input parent element on which addd is initiated.
  * @param {Object} newElements List of new elements to add
  */
function _insertAddedElementIntoVMOForSelectedParent( dataProvider, inputParentElement, newElements, sortCriteria ) {
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
            _updateParentNodeState( deferred, dataProvider, parentVMO.uid, parentIdx, newElements, sortCriteria ); //.then( function() {
        }
    } else {
        // Add root Checklist specification.
        _updateParentNodeState( deferred, dataProvider, null, parentIdx, newElements, sortCriteria );
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
    parentVMO, children, newChildIdx, childOccRespIdx, childOccurrence, topTreeNode ) {
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
        var childVMO = Apm0ChecklistTreeService.createVmNodeUsingNewObjectInfo( childOccurrence, childlevelIndex, childIdx, true );
        childVMO.selected = false;
        //Add the new treeNode to the parentVMO (if one exists) children array
        if( parentVMO && parentVMO.children ) {
            parentVMO.isLeaf = false;
            _addTreeNodeVMO( parentVMO, elementBeforeNewEle, childVMO );
        }
        // Add new treeNode to top tree node
        else {
            if( topTreeNode && topTreeNode.children ) {
                _addTreeNodeVMO( topTreeNode, elementBeforeNewEle, childVMO );
            }
        }

        for( var i = elementBeforeNewEleInVmoIdx + 1; i < viewModelCollection.loadedVMObjects.length; i++ ) {
            if( viewModelCollection.loadedVMObjects[ i ].levelNdx <= viewModelCollection.loadedVMObjects[ elementBeforeNewEleInVmoIdx ].levelNdx ) {
                break;
            }
        }

        var newIndex = i;
        viewModelCollection.loadedVMObjects.splice( newIndex, 0, childVMO );
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
        var childVMO = Apm0ChecklistTreeService.createVmNodeUsingNewObjectInfo( childOccurrence, childlevelIndex, childIdx, true );

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
  * Update tree node
  * @param {ViewModelTreeNode} treeNodeVMO parent or top tree node.
  * @param {ModelObject} elementBeforeNewEle element before new element.
  * @param {ViewModelTreeNode} childVMO new child node.
  */
function _addTreeNodeVMO( treeNodeVMO, elementBeforeNewEle, childVMO ) {
    var elementBeforeNewChildExistingIdx = _.findLastIndex( treeNodeVMO.children, function( child ) {
        return child.uid === elementBeforeNewEle.uid;
    } );
    for( var i = elementBeforeNewChildExistingIdx + 1; i < treeNodeVMO.children.length; i++ ) {
        treeNodeVMO.children[ i ].childNdx = treeNodeVMO.children[ i ].childNdx + 1;
    }
    treeNodeVMO.children.splice( elementBeforeNewChildExistingIdx + 1, 0, childVMO );
    treeNodeVMO.totalChildCount = treeNodeVMO.children.length;
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
function _updateParentNodeState( deferred, dataProvider, parentUid, parentIdx, newElements, sortCriteria ) {
    //Now get the exact viewModelTreeNode for the parent Occ in the viewModelCollection
    var viewModelCollection = dataProvider.viewModelCollection;
    var topTreeNode = dataProvider.topTreeNode;
    var policyId = policySvc.register( {
        types: [
            {
                name: 'Awp0XRTObjectSetRow',
                properties: [
                    {
                        name: 'awp0Target'
                    }
                ]
            }
        ]
    } );
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
                objectSet: 'apm0QualityChecklistList.Apm0QualityChecklist',
                parentUid: newElements.props.apm0ParentChecklist.dbValues[0]
            },
            startIndex: 0,
            searchSortCriteria: sortCriteria
        }
    };
    if( parentIdx > -1 ) {
        var parentVMO = viewModelCollection.getViewModelObject( parentIdx );

        if( parentVMO ) {
            //the parent exists in the VMO lets make sure it is now marked as parent and expanded
            soaInput.searchInput.searchCriteria.parentGUID = parentUid;
            soaInput.searchInput.maxToLoad = parentVMO.children && parentVMO.children.length > soaInput.searchInput.maxToLoad ? parentVMO.children.length : soaInput.searchInput.maxToLoad;
            soaInput.searchInput.maxToReturn = parentVMO.children && parentVMO.children.length > soaInput.searchInput.maxToLoad ? parentVMO.children.length : soaInput.searchInput.maxToReturn;
            parentVMO.expanded = true;
            parentVMO.isExpanded = true;
            parentVMO.isLeaf = false;
        }
    } else {
        soaInput.searchInput.maxToLoad = topTreeNode.children && topTreeNode.children.length > soaInput.searchInput.maxToLoad ? topTreeNode.children.length : soaInput.searchInput.maxToLoad;
        soaInput.searchInput.maxToReturn = topTreeNode.children && topTreeNode.children.length > soaInput.searchInput.maxToLoad ? topTreeNode.children.length : soaInput.searchInput.maxToReturn;
    }

    soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then( function( response ) {
        var children = [];
        if( response.searchResultsJSON ) {
            var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
            if( searchResults ) {
                for( var x = 0; x < searchResults.objects.length; ++x ) {
                    var uid = searchResults.objects[ x ].uid;
                    var obj = response.ServiceData.modelObjects[ uid ];
                    var underlyingObject = cdm.getObject( obj.props.awp0Target.dbValues[0] );
                    if ( underlyingObject ) {
                        children.push( underlyingObject );
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
                    parentVMO, children, -1, newlyAddedEleInResponseIdx, children[ newlyAddedEleInResponseIdx ], topTreeNode );

            }
        }
        deferred.resolve();
    } );

    return deferred.promise;
}


export default exports = {
    addNewElement
};
