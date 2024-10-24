// Copyright (c) 2021 Siemens

/**
 * @module js/Psi0AuthorDependencies
 */
import commandsMapService from 'js/commandsMapService';
import cdm from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import commandPanelService from 'js/commandPanel.service';
import soaSvc from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import selectionService from 'js/selection.service';
import policySvc from 'soa/kernel/propertyPolicyService';
import eventBus from 'js/eventBus';
import $ from 'jquery';
import awDragAndDropUtils from 'js/awDragAndDropUtils';
import uwPropertySvc from 'js/uwPropertyService';

var exports = {};
var parentData = {};

var modelObjectsList = [];

var PRECEDING_LIST = 'psi0_precedingList';
var CONCURRENT_LIST = 'psi0_concurrentList';
var SUCCEEDING_LIST = 'psi0_succeedingList';

/**
 * This function will subscribe for events.
 *
 * @param {Object} appCtxService - The current context.
 */
var subscribeEvents = function( appCtxService ) {
    var SplmTableElement = document.getElementsByTagName( 'aw-splm-table' );
    var tableElement = document.getElementsByTagName( 'aw-table' );
    var objectSet = !SplmTableElement ? tableElement[ 0 ].attributes.gridid.value : SplmTableElement[ 0 ].attributes.gridid.value;

    var selectionEvent = eventBus.subscribe( objectSet + '.selectionChangeEvent', function( eventData ) {
        var selectedObj = cdm.getObject( eventData.selectedUids );

        if( selectedObj !== null && selectedObj !== undefined ) {
            appCtxService.ctx.selectedObj = selectedObj;
        } else {
            appCtxService.ctx.selectedObj = appCtxService.ctx.mselected[ 0 ];
        }

        if( appCtxService.ctx.Psi0AuthorDependencies ) {
            eventBus.publish( 'Psi0AuthorDependencies.reveal' );
        }
    } );
    appCtxService.ctx.authorUnSubEvents.push( selectionEvent );
};

/** -------------------------------------------------------------------
 *  Used to clear view model
 *
 */
export let cleanupView = function() {
    if( appCtxService.ctx.authorUnSubEvents ) {
        for( var index = 0; index < appCtxService.ctx.authorUnSubEvents.length; index++ ) {
            eventBus.unsubscribe( appCtxService.ctx.authorUnSubEvents[ index ] );
        }
        appCtxService.unRegisterCtx( 'authorUnSubEvents' );
        appCtxService.unRegisterCtx( 'Psi0AuthorDependencies' );
    }
};

/**
 * Check Is Occurence.
 *
 * @param {Object} obj - Awb0Element or revision object
 * @return {boolean} true/false
 */
var _isOccurence = function( obj ) {
    if( commandsMapService.isInstanceOf( 'Awb0Element', obj.modelType ) ) {
        return true;
    }
    return false;
};
/**
 * get Revision Object.
 *
 * @param {Object} obj - Awb0Element or revision object
 * @return {Object} Revision Object
 */
var _getRevisionObject = function( obj ) {
    var revObject = null;

    if( _isOccurence( obj ) ) {
        revObject = cdm.getObject( obj.props.awb0UnderlyingObject.dbValues[ 0 ] );
    } else if( obj.uid ) {
        revObject = cdm.getObject( obj.uid );
    } else {
        revObject = cdm.getObject( obj );
    }

    return revObject;
};
/**
 * Check if underlying revision object is same
 *
 * @param {Object} obj1 - firstObject
 * @param {Object} obj2 - second object
 * @returns {Boolean} return true if both are same revision objects
 */
var _hasSameUnderlyingRevision = function( obj1, obj2 ) {
    var obj1Rev = _getRevisionObject( obj1 );
    var obj2Rev = _getRevisionObject( obj2 );

    if( obj1Rev && obj2Rev && obj1Rev.uid === obj2Rev.uid ) {
        return true;
    }
    return false;
};
/**
 * Is Object Exist in Object Array
 *
 * @param {Object} arrObjects - array of objects
 * @param {Object} objToSearch - The object to search
 * @returns {Boolean} is object Exist in data provider list
 */
var _isExistRevObjectInArray = function( arrObjects, objToSearch ) {
    for( var i = 0; i < arrObjects.length; i++ ) {
        if( _hasSameUnderlyingRevision( arrObjects[ i ], objToSearch ) ) {
            return true;
        }
    }
    return false;
};
/**
 * Remove given object from provider list.
 *
 * @param {Object} dataProvider - The view model dataProvider
 * @param {Object} obj - The object to be removed
 * @returns {Boolean} is object removed from data provider list
 */
var _removeFromDataProvider = function( dataProvider, obj ) {
    var vmo = dataProvider.viewModelCollection.loadedVMObjects;
    if( obj ) {
        for( var i = vmo.length - 1; i >= 0; i-- ) {
            if( _hasSameUnderlyingRevision( vmo[ i ], obj ) ) {
                exports.removeFromRelationList( dataProvider, obj );
                return true;
            }
        }
    }
    return true;
};
/**
 * Add in Data provide List.
 *
 * @param {Object} dataProvider - The data provider
 * @param {Object} newObj - The new object to be added
 * @returns {Boolean} is object added in data provider list
 */
var _addInDataProvider = function( dataProvider, newObj ) {
    var flagAdd = _isExistRevObjectInArray( dataProvider.viewModelCollection.loadedVMObjects, newObj );

    if( !flagAdd ) {
        let vmoNewObj = cdm.getObject( newObj );
        dataProvider.viewModelCollection.loadedVMObjects.push( vmoNewObj );
        modelObjectsList.push( newObj );
        return true;
    }
    return false;
};

/**
 * Add in Object List.
 *
 * @param {Object} deferred - To resolve the request
 * @param {Object} data - The view model data
 * @param {Object} destObjectList - The view model data
 * @param {Object} otherRelList - The view model data
 * @param {Object} otherRelList1 - The view model data
 * @param {Object} newObjs - objects to be added in End Item list
 * @returns {Promise} - Resolved when all processing is complete.
 */
var _addInObjectList = function( deferred, data, destObjectList, otherRelList, otherRelList1, newObjs ) {
    for( var i = 0; i <= newObjs.length - 1; i++ ) {
        var newObj = _getRevisionObject( newObjs[ i ] );

        var isExistInOtherList = _isExistRevObjectInArray( destObjectList.viewModelCollection.loadedVMObjects, newObj );
        if( isExistInOtherList ) {
            eventBus.publish( 'Psi0AuthorDependencies.objectPresentError' );
        }

        isExistInOtherList = _isExistRevObjectInArray( otherRelList.viewModelCollection.loadedVMObjects, newObj );
        if( isExistInOtherList ) {
            // Remove object from second list before adding to Destination list
            _removeFromDataProvider( otherRelList, newObjs[ i ] );
        }

        isExistInOtherList = _isExistRevObjectInArray( otherRelList1.viewModelCollection.loadedVMObjects, newObj );
        if( isExistInOtherList ) {
            // Remove object from second list before adding to Destination list
            _removeFromDataProvider( otherRelList1, newObjs[ i ] );
        }
        var memberModelObjects = otherRelList.viewModelCollection.loadedVMObjects;
        otherRelList.update( memberModelObjects );

        var memberModelObjects1 = otherRelList1.viewModelCollection.loadedVMObjects;
        otherRelList1.update( memberModelObjects1 );

        _addInDataProvider( destObjectList, newObjs[ i ] );

        var memberModelObjects2 = destObjectList.viewModelCollection.loadedVMObjects;
        destObjectList.update( memberModelObjects2 );
    }
};
/**
 *  Checks for Due date Conflict
 *
 * @param {Object} targetObject - drop target object
 * @param {Array} sourceObjects - dragged sources objects
 * @param {Object} selection - current selected object
 * @returns {Promise} - Resolved when all processing is complete.
 */
var checkForDueDateConflict = function( targetObject, sourceObjects, selection ) {
    let sourceObj = cdm.getObject( sourceObjects.uidList[ 0 ] );
    var sourceDate = sourceObj.props.psi0DueDate.dbValues[ 0 ];
    var targetDate = selection[ 0 ].props.psi0DueDate.dbValues[ 0 ];
    if( targetObject.uid === PRECEDING_LIST && sourceDate > targetDate || targetObject.uid === SUCCEEDING_LIST && sourceDate < targetDate ) {
        var context = {
            destPanelId: 'DependencyPanel',
            selection: selection,
            targetObject: targetObject,
            sourceObjects: sourceObj
        };
        eventBus.publish( 'Psi0AuthorDependencies.dueDateConflictWarning', context );
        return true;
    }
};

/**
 * Adds object into Preceding/Succedding list
 *
 * @param {Object} eventData - drop target and source object
 * @returns {Promise} - Resolved when all processing is complete.
 */
export let addIntoList = function( eventData ) {
    var deferred = AwPromiseService.instance.defer();
    var providerList = parentData.dataProviders;

    if( eventData.targetObject && eventData.targetObject.uid === PRECEDING_LIST ) {
        _addInObjectList( deferred, parentData, providerList.psi0_precedingList, providerList.psi0_succeedingList, providerList.psi0_concurrentList, eventData.sourceObjects );
    } else if( eventData.targetObject && eventData.targetObject.uid === SUCCEEDING_LIST ) {
        _addInObjectList( deferred, parentData, providerList.psi0_succeedingList, providerList.psi0_precedingList, providerList.psi0_concurrentList, eventData.sourceObjects );
    }
    deferred.resolve();
    return deferred.promise;
};

/**
 * @param {Object} targetObject - drop target object
 * @param {Array} sourceObjects - dragged sources objects
 * @returns {Promise} Resolved when all processing is complete.
 */
export let pasteDependenciesObjectsInList = function( targetObject, sourceObjects ) {
    let sourceObj = cdm.getObject( sourceObjects.uidList[ 0 ] );
    if( sourceObj.modelType.typeHierarchyArray.indexOf( 'Psi0PrgDelRevision' ) === -1 ) {
        eventBus.publish( 'Psi0AuthorDependencies.objectNotSupportedError' );
    }

    var selection = appCtxService.getCtx( "panelContext.selectedObjs" );
    if( selection[ 0 ].uid === sourceObjects.uidList[ 0 ] ) {
        eventBus.publish( 'Psi0AuthorDependencies.sameObjectError' );
    }

    if( checkForDueDateConflict( targetObject, sourceObjects, selection ) ) {
        eventBus.publish( 'Psi0AuthorDependencies.sameObjectError' );
    }
    var deferred = null;

    if( targetObject && targetObject.uid === 'psi0_precedingList' ) {
        _addInObjectList( deferred, parentData, parentData.dataProviders.psi0_precedingList, parentData.dataProviders.psi0_succeedingList,
            parentData.dataProviders.psi0_concurrentList, sourceObjects.uidList );
    } else if( targetObject && targetObject.uid === 'psi0_succeedingList' ) {
        _addInObjectList( deferred, parentData, parentData.dataProviders.psi0_succeedingList, parentData.dataProviders.psi0_precedingList,
            parentData.dataProviders.psi0_concurrentList, sourceObjects.uidList );
    } else if( targetObject && targetObject.uid === 'psi0_concurrentList' ) {
        _addInObjectList( deferred, parentData, parentData.dataProviders.psi0_concurrentList, parentData.dataProviders.psi0_precedingList,
            parentData.dataProviders.psi0_succeedingList, sourceObjects.uidList );
    }
};

export let getAuthorDependencyPanel = function( commandId, location, context, config ) {
    var deliverable = 'Psi0AuthorDependencies';
    var selection = selectionService.getSelection().selected;
    if( selection && selection.length > 0 ) {
        var parent = selectionService.getSelection().parent;
        var jso;
        jso = {
            DeliverableMember: selection[ 0 ],
            selectedObject: parent
        };
        appCtxService.registerCtx( deliverable, jso );
    } else {
        appCtxService.unRegisterCtx( deliverable );
    }
    commandPanelService.activateCommandPanel( commandId, location, context, null, null, config );
};

let getAuthorDependencyVMO = function( data, type ) {
    let vmo;
    if( type === 'Concurrent' || type === 'psi0_concurrentList' ) {
        vmo = {
            uid: CONCURRENT_LIST,
            props: {
                object_string: {
                    uiValues: [ data.i18n.concurrent ]
                }
            },
            modelType: {
                typeHierarchyArray: [ 'Psi0AuthorDependencies' ]
            }
        };
    } else if( type === 'Preceding' || type === 'psi0_precedingList' ) {
        vmo = {
            uid: PRECEDING_LIST,
            props: {
                object_string: {
                    uiValues: [ data.i18n.preceding ]
                }
            },
            modelType: {
                typeHierarchyArray: [ 'Psi0AuthorDependencies' ]
            }
        };
    } else {
        vmo = {
            uid: SUCCEEDING_LIST,
            props: {
                object_string: {
                    uiValues: [ data.i18n.succeeding ]
                }
            },
            modelType: {
                typeHierarchyArray: [ 'Psi0AuthorDependencies' ]
            }
        };
    }
    return vmo;
};
/**
 * This function sets targetvmo to ChangeImpactedItem for drag and drop
 * on persisted impacted table element. It will also set the allowed source types for drop
 * on this table and will set dropuid to selected change for source to be pasted on.
 * @param {object} data
 */
export let setDropTargetOnAuthorDependencies = function( data, type ) {
    data.vmo = getAuthorDependencyVMO( data, type );
};

/**
 * Do the perform search call to populate the Concurrent list based on object values
 *
 * @param {dataList} searchResultData - The data list with original results
 * @param {dataProvider} dataProvider - The data provider that will be used to get the correct content
 * @returns {Array} - newly added data in list
 */
var getAddedListForSOA = function( searchResultData, dataProvider ) {
    var new_list = [];
    var model_objects = [];
    var relationList = dataProvider.viewModelCollection.loadedVMObjects;
    var originalRelationList = searchResultData;
    var search_list = [];

    relationList.forEach( function( listObj ) {
        listObj = cdm.getObject( listObj.uid );
        new_list.push( listObj );
    } );
    if( originalRelationList ) {
        originalRelationList.forEach( function( listObj ) {
            listObj = cdm.getObject( listObj.uid );
            search_list.push( listObj.uid );
        } );

        if( new_list && search_list.length > 0 ) {
            model_objects = $.grep( new_list, function( eachObject ) {
                return $.inArray( eachObject.uid, search_list ) === -1;
            } );
            return model_objects;
        }
    }
    return new_list;
};

/**
 * Do the perform search call to populate the Concurrent list based on object values
 *
 * @param {dataList} searchResultData - The data list with original results
 * @param {dataProvider} dataProvider - The data provider that will be used to get the correct content
 * @returns {Array} - returns deleted object list
 */
var getDeletedListForSOA = function( searchResultData, dataProvider ) {
    var new_list = [];
    var model_objects = [];
    var relationList = dataProvider.viewModelCollection.loadedVMObjects;

    relationList.forEach( function( listObj ) {
        listObj = cdm.getObject( listObj.uid );
        new_list.push( listObj.uid );
    } );

    if( searchResultData && new_list.length > 0 ) {
        model_objects = $.grep( searchResultData, function( eachObject ) {
            return $.inArray( eachObject.uid, new_list ) === -1;
        } );
        return model_objects;
    }
    return searchResultData;
};

/**
 * Do the perform search call to populate the preceding list based on object values
 *
 * @param {ctx} ctx - The ctx of the viewModel
 * @param {data} data - The qualified data of the viewModel
 * @param {dataProvider} dataProvider - The data provider that will be used to get the correct content
 * @param {boolean} recalcSequence - The data provider that will be used to get the correct content
 * @returns {Object} - returns soa input data
 */
export let createDeliverableDependencies = function( ctx, data, dataProvider, recalcSequence ) {
    // Check is data provider is null or undefined then no need to process further
    // and return from here
    if( !dataProvider ) {
        return;
    }

    var selected = cdm.getObject( ctx.mselected[ 0 ].uid );
    var modelObject = ctx.xrtSummaryContextObject;

    var detachedDeliverables = [];
    var deletedPrecedingList = [];
    var deletedSucceedingList = [];
    var deletedConcurrentList = [];
    var addedPrecedingList = [];
    var addedSucceedingList = [];
    var addedConcurrentList = [];

    deletedPrecedingList = getDeletedListForSOA( data.psi0_precedingSearchResults, dataProvider.psi0_precedingList );
    if( deletedPrecedingList && deletedPrecedingList.length > 0 ) {
        detachedDeliverables = detachedDeliverables.concat( deletedPrecedingList );
    }
    deletedSucceedingList = getDeletedListForSOA( data.psi0_succeedingSearchResults, dataProvider.psi0_succeedingList );
    if( deletedSucceedingList && deletedSucceedingList.length > 0 ) {
        detachedDeliverables = detachedDeliverables.concat( deletedSucceedingList );
    }

    deletedConcurrentList = getDeletedListForSOA( data.psi0_concurrentSearchResults, dataProvider.psi0_concurrentList );
    if( deletedConcurrentList && deletedConcurrentList.length > 0 ) {
        detachedDeliverables = detachedDeliverables.concat( deletedConcurrentList );
    }

    addedPrecedingList = getAddedListForSOA( data.psi0_precedingSearchResults, dataProvider.psi0_precedingList );
    addedSucceedingList = getAddedListForSOA( data.psi0_succeedingSearchResults, dataProvider.psi0_succeedingList );
    addedConcurrentList = getAddedListForSOA( data.psi0_concurrentSearchResults, dataProvider.psi0_concurrentList );

    return {
        eventObject: modelObject,
        contextObject: selected,
        successors: addedSucceedingList,
        predecessors: addedPrecedingList,
        concurrent: addedConcurrentList,
        detachDeliverables: detachedDeliverables,
        manageOptions: {
            recalculateSequence: recalcSequence
        }
    };
};

/**
 * Method to update search results as per data providers
 *
 * @param {searchList} searchList - The data list with original results
 * @param {dataProvider} dataProvider - The qualified data of the viewModel
 */
export let updateSearchResultsInList = function( searchList, dataProvider ) {
    var relationList = dataProvider.viewModelCollection.loadedVMObjects;

    if( relationList ) {
        relationList.forEach( function( listObj ) {
            var modelObj = cdm.getObject( listObj.uid );
            searchList.push( modelObj );
        } );
    }
};

/**
 * Method to update search results as per data providers
 *
 * @param {data} data - The data list with original results
 * @param {dataProvider} dataProvider - The qualified data of the viewModel
 */
export let updateSearchResults = function( data, dataProvider ) {
    data.psi0_precedingSearchResults = [];
    data.psi0_succeedingSearchResults = [];
    data.psi0_concurrentSearchResults = [];

    exports.updateSearchResultsInList( data.psi0_precedingSearchResults, dataProvider.psi0_precedingList );
    exports.updateSearchResultsInList( data.psi0_succeedingSearchResults, dataProvider.psi0_succeedingList );
    exports.updateSearchResultsInList( data.psi0_concurrentSearchResults, dataProvider.psi0_concurrentList );
};
/**
 * Method to remove relation from available section of panel
 *
 * @param {dataProvider} dataProvider - The qualified data of the viewModel
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 */
export let removeFromRelationList = function( dataProvider, vmo ) {
    if( vmo && dataProvider ) {
        var removeRelation = [];
        if( vmo.uid ) {
            removeRelation.push( vmo.uid );
        } else {
            removeRelation.push( vmo );
        }

        var memberModelObjects = dataProvider.viewModelCollection.loadedVMObjects;

        var modelObjects = $.grep( memberModelObjects, function( eachObject ) {
            return $.inArray( eachObject.uid, removeRelation ) === -1;
        } );
        dataProvider.update( modelObjects );
    }
};

/**
 *
 * @param {default parameters for DnD} dragAndDropParams
 */
export let panelViewDragOver = ( dragAndDropParams ) => {
    if( dragAndDropParams.dataProvider ) {
        dragAndDropParams.callbackAPIs.highlightTarget( {
            isHighlightFlag: true,
            targetElement: dragAndDropParams.targetElement
        } );
        return {
            dropEffect: 'copy',
            stopPropagation: true,
            preventDefault: true
        };
    }
    return {
        dropEffect: 'none',
        stopPropagation: true
    };
};

/**
 * Function to create a relation between the impacted item dragged over on persisted
 * impacted panel, and the change object, when that item is dropped over the panel.
 */
export let panelViewDropOver = ( dragAndDropParams ) => {
    let vmoName = dragAndDropParams.dataProvider.viewModelCollection.name;
    let targetObject = getAuthorDependencyVMO( parentData, vmoName );

    let sourceObjects = awDragAndDropUtils.getCachedDragData();
    pasteDependenciesObjectsInList( targetObject, sourceObjects );
};
/**
 * Function to set parentData
 */
export let setParentData = function( data ) {
    parentData = data;
};
/**
 * Function to call removeFromRelationList for precedingList
 */
export let removeFromPrecedingRelationList = function( vmo ) {
    let dataProvider = parentData.dataProviders.psi0_precedingList;
    removeFromRelationList( dataProvider, vmo );
};
/**
 * Function to call removeFromRelationList for succeedingList
 */
export let removeFromSucceedingRelationList = function( vmo ) {
    let dataProvider = parentData.dataProviders.psi0_succeedingList;
    removeFromRelationList( dataProvider, vmo );
};

/**
 * Function to call removeFromRelationList for concurrentList
 */
export let removeFromConcurrentRelationList = function( vmo ) {
    let dataProvider = parentData.dataProviders.psi0_concurrentList;
    removeFromRelationList( dataProvider, vmo );
};

export default exports = {
    cleanupView,
    addIntoList,
    pasteDependenciesObjectsInList,
    getAuthorDependencyPanel,
    createDeliverableDependencies,
    updateSearchResultsInList,
    updateSearchResults,
    removeFromRelationList,
    setDropTargetOnAuthorDependencies,
    panelViewDragOver,
    panelViewDropOver,
    setParentData,
    removeFromPrecedingRelationList,
    removeFromSucceedingRelationList,
    removeFromConcurrentRelationList
};
