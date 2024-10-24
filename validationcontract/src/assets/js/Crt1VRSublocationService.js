// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Crt1VRSublocationService
 */
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import selectionService from 'js/selection.service';
import appCtxSvc from 'js/appCtxService';
import awTableSvc from 'js/awTableService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import awColumnService from 'js/awColumnService';
import tcVmoService from 'js/tcViewModelObjectService';
import _cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import localeService from 'js/localeService';
import awIconService from 'js/awIconService';
import tcSessionData from 'js/TcSessionData';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';
import navigationSvc from 'js/navigationService';

var exports = {};
var policyIOverride = {
    types: [ {
        name: 'WorkspaceObject',
        properties: [ {
            name: 'object_string'
        } ]
    },
    {
        name: 'Crt0VldnContractRevision',
        properties: [ {
            name: 'crt0ChildrenStudies'
        } ]
    }
    ]
};

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
        clientScopeURI: 'Crt1ScopeTable'
    };

    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if ( !childNode.props ) {
                childNode.props = {};
            }

            allChildNodes.push( childNode );
        } );
    } );
    eventBus.publish( 'vrPWATreeTable.setSelection' );
    var propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( allChildNodes );

    return tcVmoService.getTableViewModelProperties( allChildNodes, propertyLoadContext ).then(
        function( response ) {
            _.forEach( allChildNodes, function( childNode ) {
                var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm
                    .getObject( childNode.id ), 'EDIT' );
                _.forEach( vmo.props, function( vmProp ) {
                    childNode.props[vmProp.propertyName] = vmProp;
                    var propColumns = response.output.columnConfig.columns;
                    updateTypeNamePropInColConfig( propColumns );
                } );
                if ( childNode.props.att1SourceAttribute ) {
                    var srcObject = cdm.getObject( childNode.props.att1SourceAttribute.dbValues[0] );
                    if ( srcObject.modelType.typeHierarchyArray.indexOf( 'Att0ParamGroup' ) > -1 && srcObject.props.att0ChildParamValues.dbValues[0] === undefined && srcObject.props
                        .att0ChildParamGroups.dbValues[0] === undefined ) {
                        childNode.isLeaf = true;
                    }
                }
            } );
            if ( response ) {
                propertyLoadResult.columnConfig = response.output.columnConfig;
            }
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
        if ( !col.typeName && col.associatedTypeName ) {
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
export let loadTreeTableProperties = function( propertyLoadInput, vrSublocationState, dataProvider ) { // eslint-disable-line no-unused-vars
    /**
      * Extract action parameters from the arguments to this function.
      */

    if ( dataProvider ) {
        var loadedVMOObjects = dataProvider.viewModelCollection.loadedVMObjects;
    }

    // Store the loaded elements of PWA tree in vr state.
    // When getResultAndChartData SOA is called, send all these elements to server as input.
    var elementsToStore = [];

    //If elements are already stored, append new elements to existing list.
    if ( vrSublocationState && vrSublocationState.pwaTreeElements &&
        vrSublocationState.pwaTreeElements.length > 0 ) {
        elementsToStore = vrSublocationState.pwaTreeElements;
        if ( loadedVMOObjects && loadedVMOObjects !== undefined ) {
            for ( let i = 0; i < loadedVMOObjects.length; i++ ) {
                let elementAlreadyStored = false;
                for ( let j = 0; j < vrSublocationState.pwaTreeElements.length; j++ ) {
                    if ( loadedVMOObjects[i].uid === vrSublocationState.pwaTreeElements[j].contentObject.uid ) {
                        elementAlreadyStored = true;
                    }
                }
                if ( !elementAlreadyStored ) {
                    let pwaElements = {
                        contentObject: {
                            type: loadedVMOObjects[i].type,
                            uid: loadedVMOObjects[i].uid
                        },
                        result: '',
                        resultInfo: ''
                    };
                    elementsToStore.push( pwaElements );
                }
            }
        }
    }
    //If elements are not stored before, then push all elements in vr state.
    else {
        if ( loadedVMOObjects !== null && loadedVMOObjects !== undefined ) {
            for ( var i = 0; i < loadedVMOObjects.length; i++ ) {
                var pwaElements = {
                    contentObject: {
                        type: loadedVMOObjects[i].type,
                        uid: loadedVMOObjects[i].uid
                    },
                    result: '',
                    resultInfo: ''
                };
                elementsToStore.push( pwaElements );
            }
        }
    }
    var newvrSublocationState = { ...vrSublocationState.value };
    newvrSublocationState.pwaTreeElements = elementsToStore;
    vrSublocationState.update && vrSublocationState.update( newvrSublocationState );

    var propertyLoadInput = awTableSvc.findPropertyLoadInput( arguments );

    if ( propertyLoadInput ) {
        return _loadProperties( propertyLoadInput );
    }

    return AwPromiseService.instance.reject( 'Missing PropertyLoadInput parameter' );
};

export let setSelectionBackInPWA = function( data ) {
    if ( data && data.dataProviders ) {
        var selModel = data.dataProviders.gridDataProvider.selectionModel;
        var PWATableSelection;
        if ( data && data.eventData && data.eventData.elementsToSelect ) {
            PWATableSelection = data.eventData.elementsToSelect;
        } else if ( appCtxSvc.ctx.previousSelection ) {
            PWATableSelection = appCtxSvc.ctx.previousSelection;
        }

        selModel.setSelection( PWATableSelection );
    }
};
/**
  * @param {Object} obj - Object sent by server
  * @param {childNdx} childNdx Child Index
  * @param {levelNdx} levelNdx Level Index
  * @param {parentNode} parentNode Parent node
  * @return {ViewModelTreeNode} View Model Tree Node
  */
function createVMNodeUsingObjectInfo( obj, childNdx, levelNdx ) {
    var displayName;
    var objUid = obj.uid;
    var objType = obj.type;
    var hasChildren = containChildren( obj.props );
    if ( obj.props ) {
        if ( obj.props.object_name ) {
            displayName = obj.props.object_name.uiValues[0];
        } else {
            let objStr = obj.props.object_string.uiValues[0];
            let splitStr = objStr.split( '-' );
            displayName = splitStr[1];
        }
    }
    // get Icon for node
    var iconURL = awIconService.getTypeIconFileUrl( obj );
    var vmNode = awTableTreeSvc.createViewModelTreeNode( objUid, objType, displayName, levelNdx, childNdx, iconURL );
    vmNode.isLeaf = !hasChildren;
    return vmNode;
}

/**
  * function to evaluate if an object contains children
  * @param {objectType} object object
  * @return {boolean} if node contains child
  */
function containChildren( props ) {
    if ( props && props.crt0ChildrenStudies && props.crt0ChildrenStudies.dbValues.length > 0 ) {
        return true;
    }
    return false;
}

/**
  * @param {TreeLoadInput} treeLoadInput - An Object this action function is invoked from. The object is usually
  *            the result of processing the 'inputData' property of a DeclAction based on data from the current
  *            DeclViewModel on the $scope) . The 'pageSize' properties on this object is used (if defined).
  * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
  *         available.
  */
export let loadTreeTableData = function( treeLoadInput, subPanelContext ) {
    /**
      * Check the validity of the parameters
      */
    var deferred = AwPromiseService.instance.defer();


    /**
      * Get the 'child' nodes async
      */
    _buildTreeTableStructure( treeLoadInput.parentNode, deferred, treeLoadInput, subPanelContext );

    return deferred.promise;
};

function createVMNodeForRoot( obj, childNdx, levelNdx ) {
    var displayName;
    var objUid = obj.uid;
    var objType = obj.type;
    var hasChildren = containChildren( obj.props );

    if ( obj.props ) {
        if ( obj.props.object_name ) {
            displayName = obj.props.object_name.uiValues[0];
        } else {
            let objStr = obj.props.object_string.uiValues[0];
            let splitStr = objStr.split( '-' );
            displayName = splitStr[1];
        }
    }
    // get Icon for node
    var iconURL = awIconService.getTypeIconFileUrl( obj );
    var vmNode = awTableTreeSvc.createViewModelTreeNode( objUid, objType, displayName, levelNdx, childNdx, iconURL );
    vmNode.isLeaf = !hasChildren;
    return vmNode;
}

var getUniqueIdForEachNode = function( vmNode, parentNode ) {
    if ( parentNode ) {
        return parentNode.alternateID ? vmNode.uid + ',' + parentNode.alternateID : vmNode.uid + ',' + parentNode.id;
    }
    return vmNode.uid;
};

/**
  * @param {ViewModelTreeNode} parentNode - A node that acts as 'parent' of a hierarchy of 'child'
  *            ViewModelTreeNodes.
  * @param {DeferredResolution} deferred - Resolved with a resulting TreeLoadResult object.
  * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
  * @return {TreeLoadResult} A new TreeLoadResult object containing result/status information.
  *
  */

function _buildRootPath( parentModelObj, addExtraTopNodeInRootPathHierarchy, totalFound ) {
    /**
      * Determine the path to the 'root' occurrence IModelObject starting at the immediate 'parent' (t_uid)
      * object.
      */
    var rootPathNodes = [];
    var rootPathObjects = [];
    var pathModelObject = parentModelObj;

    if ( pathModelObject ) {
        rootPathObjects.push( pathModelObject );

        if ( addExtraTopNodeInRootPathHierarchy ) {
            rootPathObjects.push( pathModelObject );
        }
    }

    /**
      * Determine new 'top' node by walking back from bottom-to-top of the rootPathObjects and creating nodes to
      * wrap them.
      */
    var nextLevelNdx = -1;

    for ( var ndx = rootPathObjects.length - 1; ndx >= 0; ndx-- ) {
        var currNode = createVMNodeForRoot( rootPathObjects[ndx], 0, nextLevelNdx++ );
        var rootPathNodesLength = rootPathObjects.length - 1;
        /**
          * Note: We mark all necessary 'parent' path nodes as 'placeholders' so that we can find them later and
          * fill them out as needed (when they come into view)
          */
        var isPlaceholder = !( ndx === rootPathNodesLength || addExtraTopNodeInRootPathHierarchy && ndx === rootPathNodesLength - 1 );
        currNode.alternateID = getUniqueIdForEachNode( currNode );
        currNode.isExpanded = true;
        currNode.isPlaceholder = isPlaceholder;
        currNode.totalFound = totalFound;
        if ( totalFound > 0 ) {
            currNode.isLeaf = false;
        }
        rootPathNodes.push( currNode );
    }
    return rootPathNodes;
}

function _buildTreeTableStructure( parentNode, deferred, treeLoadInput, subPanelContext ) {
    treeLoadInput.parentElement = parentNode.levelNdx === -1 ? 'AAAAAAAAAAAAAA' : parentNode.id;
    treeLoadInput.displayMode = 'Tree';
    var soaInput = _prepareSoaInputForTreeLoad( parentNode, subPanelContext );
    return soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput, policyIOverride ).then(
        function( response ) {
            var vmNodes = [];
            var target = {};
            var treeLoadOutput = {};
            if ( !parentNode.isExpanded ) {
                target.uid = subPanelContext.openedObject.uid;
            } else {
                target.uid = parentNode.id;
                target.type = parentNode.type;
            }
            if ( !parentNode.isExpanded ) {
                var emptyFolderOpened = _.isEmpty( response.searchResults ) && response.totalFound === 0;

                var rootPathNodes = _buildRootPath( cdm.getObject( target.uid ), !emptyFolderOpened, response.totalFound );

                if ( rootPathNodes.length > 0 ) {
                    treeLoadOutput.rootPathNodes = rootPathNodes;
                    treeLoadOutput.newTopNode = _.first( treeLoadOutput.rootPathNodes );
                }
            }

            if ( !emptyFolderOpened ) {
                if ( response.searchResultsJSON ) {
                    var searchResults = JSON.parse( response.searchResultsJSON );
                    if ( searchResults ) {
                        for ( var x = 0; x < searchResults.objects.length; ++x ) {
                            var uid = searchResults.objects[x].uid;
                            var obj = cdm.getObject( uid );
                            if ( obj ) {
                                vmNodes.push( obj );
                            }
                        }
                    }
                }
            } else {
                vmNodes.push( _.first( rootPathNodes ) );
            }


            var endReachedVar = response.totalLoaded + treeLoadInput.startChildNdx === response.totalFound;
            var startReachedVar = true;

            var tempCursorObject = {
                endReached: endReachedVar,
                startReached: true
            };
            var treeLoadResult = processProviderResponse( treeLoadInput, vmNodes, startReachedVar, endReachedVar );
            _.forEach( treeLoadOutput, function( value, name ) {
                if ( !_.isUndefined( value ) ) {
                    treeLoadResult[name] = value;
                }
            } );
            treeLoadResult.parentNode.cursorObject = tempCursorObject;
            _manageRuleChange( deferred, treeLoadResult );
        },
        function( error ) {
            deferred.reject( error );
        } );
}

var _prepareSoaInputForTreeLoad = function( parentNode, subPanelContext ) {
    var target = {};
    if ( !parentNode.isExpanded ) {
        target.uid = subPanelContext.openedObject.uid;
    } else {
        target.uid = parentNode.id;
        target.type = parentNode.type;
    }
    return {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: 'Crt1ScopeTable'
        },
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Awp0ObjectSetRowProvider',
            searchCriteria: {
                parentUid: target.uid,
                objectSet: 'crt0ChildrenStudies.Crt0StudyRevision',
                returnTargetObjs: 'true',
                showConfiguredRev: 'true',
                dcpSortByDataProvider: 'true'
            },
            columnFilters: [],
            searchFilterFieldSortType: 'Alphabetical',
            searchSortCriteria: [ {
                fieldName: '',
                sortDirection: ''
            } ]
        },
        inflateProperties: true
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
    var vmNode;
    for ( var childNdx = 0; childNdx < searchResults.length; childNdx++ ) {
        var object = searchResults[childNdx];
        if ( !awTableSvc.isViewModelTreeNode( object ) ) {
            vmNode = createVMNodeUsingObjectInfo( object, childNdx, levelNdx );
        } else {
            vmNode = object;
        }
        if ( vmNode ) {
            vmNodes.push( vmNode );
        }
    }
    parentNode.isLeaf = searchResults.length === 0;

    return awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, startReached, endReached, null );
}
var _manageRuleChange = function( deferred, treeLoadResult ) {
    deferred.resolve( {
        treeLoadResult: treeLoadResult
    } );
};

/**
  * This method will get called when vrSublocationState will implement
  * @param {*} selectedObjects
  * @param {*} openedObject
  * @param {*} vrSublocationState
  */
export const syncSelections = ( selectedObjects, openedObject, vrSublocationState = {} ) => {
    if ( vrSublocationState && vrSublocationState.mselected && vrSublocationState.mselected[0] && vrSublocationState.mselected[0].uid &&
        selectedObjects && selectedObjects[0] && selectedObjects[0].uid && vrSublocationState.mselected[0].uid !== selectedObjects[0].uid ) {
        var newvrSublocationState = { ...vrSublocationState.value };
        newvrSublocationState.mselected = [];
        //update selected object in vrSublocationState
        if ( selectedObjects && selectedObjects.length > 0 ) {
            // get the selected attributes
            for ( var idx = 0; idx < selectedObjects.length; ++idx ) {
                newvrSublocationState.mselected.push( selectedObjects[idx] );
            }
        } else {
            //if nothing is selected then set opened object in mselected
            newvrSublocationState.mselected.push( openedObject );
        }
    }
    if ( newvrSublocationState !== undefined && newvrSublocationState !== null ) {
        //If selection change in PWA tree has happened before/First time user is selecting object other than opened object in PWA tree then set isStateUpdated to false
        //In these cases, Crt1VROverviewTables will mount again and flag(isStateUpdated) will become true
        if ( newvrSublocationState.selectionChanged === false || newvrSublocationState.selectionChanged === true ||
            !newvrSublocationState.selectionChanged &&
            ( selectedObjects && selectedObjects[0] && selectedObjects[0].uid ) &&
            ( openedObject && openedObject.uid &&
                openedObject.uid !== selectedObjects[0].uid ) ) {
            newvrSublocationState.isStateUpdated = false;
        } //First time user is selecting in PWA tree same object as opened object set isStateUpdated to true
        //Because in this case,Crt1VROverview component will not mount again to make the flag true
        else if ( !newvrSublocationState.selectionChanged && selectedObjects && selectedObjects[0] && selectedObjects[0].uid && openedObject && openedObject.uid &&
            openedObject.uid === selectedObjects[0].uid ) {
            newvrSublocationState.isStateUpdated = true;
        }
    }
    if ( newvrSublocationState !== undefined && newvrSublocationState !== null ) {
        newvrSublocationState.selectionChanged = true;
        vrSublocationState.update && vrSublocationState.update( newvrSublocationState );
    }
};

/**
  * Initalize vrstate with default value.
  * @param {*} openedObject
  */
export let initializeVRState = function( openedObject, vrSublocationState ) {
    var newvrSublocationState = { ...vrSublocationState.value };
    newvrSublocationState.mselected = [ openedObject ];
    appCtxSvc.registerCtx( 'vr_previousSelectionForExecute', openedObject );
    vrSublocationState.update && vrSublocationState.update( newvrSublocationState );
};

export let registerCtxSelection = function( dataProvider, eventData, subPanelContext ) {
    //Code to update selection when object selection is changed in PWA

    if ( subPanelContext && subPanelContext.selectionData.selected && subPanelContext.selectionData.selected.length > 0 && subPanelContext.selectionData.selected[0].uid ) {
        var selectionUid = subPanelContext.selectionData.selected[0].uid;
        selection = _cdm.getObject( selectionUid );
    } else if ( eventData && eventData.selectedUids && eventData.selectedUids.length === 0 ) {
        //Set selection to open object when selection Data is empty.
        selection = _cdm.getObject( subPanelContext.openedObject.uid );
        var selModel = dataProvider.selectionModel;
        selModel.setSelection( selection );
    }
    var array = [];
    array.push( selection );
    var parentSelection;
    var selection = selectionService.getSelection();
    if ( selection.parent ) {
        parentSelection = selection.parent;
    }
    if ( array.length > 0 ) {
        selectionService.updateSelection( array, parentSelection );
    }
    if ( subPanelContext && subPanelContext.selectionData && subPanelContext.selectionData.value ) {
        const tmpSelectionData = { ...subPanelContext.selectionData.value };
        tmpSelectionData.selected = array;
        subPanelContext.selectionData.update( tmpSelectionData );
    }

    //In case of legacy project update selected objects in parametersState
    if ( eventData ) {
        appCtxSvc.registerCtx( 'aceSelectionData', eventData.selectedObjects );
    }
    if ( dataProvider && dataProvider.selectedObjects && dataProvider.selectedObjects.length > 0 ) {
        appCtxSvc.registerCtx( 'previousSelection', dataProvider.selectedObjects[0] );
        appCtxSvc.registerCtx( 'vr_previousSelectionForExecute', dataProvider.selectedObjects[0] );
    }
};

function getResultProperty() {
    let resultProp;
    let tcMajor = tcSessionData.getTCMajorVersion();
    let tcMinor = tcSessionData.getTCMinorVersion();
    if ( tcMajor >= 13 && tcMinor >= 3 || tcMajor >= 14 ) {
        resultProp = 'crt0RolledupResult';
    }
    if ( !resultProp ) {
        resultProp = 'crt0Result';
    }
    return resultProp;
}

export let applyResultRedColourBar = function( vmo ) {
    let resultProp = getResultProperty();
    appCtxSvc.updatePartialCtx( 'decoratorToggle', true );
    if ( vmo && vmo.props && vmo.props[resultProp] && vmo.props[resultProp].dbValues &&
        vmo.props[resultProp].dbValues.length > 0 && vmo.props[resultProp].dbValues[0] === '100' ) {
        return true;
    }
    return false;
};

export let applyResultBlueColourBar = function( vmo ) {
    if ( appCtxSvc.ctx.preferences.PLE_Rollup_Result_Enable !== undefined && appCtxSvc.ctx.preferences.PLE_Rollup_Result_Enable[0] === 'true' ) {
        let resultProp = getResultProperty();
        var crt0Result;
        if ( vmo.props && vmo.props.crt0Result && vmo.props.crt0Result.dbValue ) {
            crt0Result = vmo.props.crt0Result.dbValue;
        }
        if ( resultProp === 'crt0RolledupResult' ) {
            appCtxSvc.updatePartialCtx( 'decoratorToggle', true );
            if ( ( appCtxSvc.ctx.tcSessionData.tcMajorVersion === 14 && appCtxSvc.ctx.tcSessionData.tcMinorVersion === 0 || appCtxSvc.ctx.tcSessionData.tcMajorVersion < 14 ) && ( crt0Result &&
                crt0Result === '100' || crt0Result && crt0Result === '200' ) ) {
                return true;
            } else if ( appCtxSvc.ctx.tcSessionData.tcMajorVersion >= 14 && appCtxSvc.ctx.tcSessionData.tcMinorVersion >= 1 && ( vmo.props[resultProp] && ( vmo.props[resultProp].dbValues[0] ===
                '100' || vmo.props[resultProp].dbValues[0] === '200' ) ) &&
                vmo.props && vmo.props.crt0IsResultOverriden && vmo.props.crt0IsResultOverriden.dbValues[0] === '1' ) {
                return true;
            }
        }
    }
    return false;
};

export let applyResultGreenColourBar = function( vmo ) {
    let resultProp = getResultProperty();
    appCtxSvc.updatePartialCtx( 'decoratorToggle', true );
    if ( vmo && vmo.props && vmo.props[resultProp] && vmo.props[resultProp].dbValues &&
        vmo.props[resultProp].dbValues.length > 0 && vmo.props[resultProp].dbValues[0] === '200' ) {
        return true;
    }
    return false;
};

//Remove color bar of object to show no result status
export let removeResultColourBar = function( vmo ) {
    let resultProp = getResultProperty();
    appCtxSvc.updatePartialCtx( 'decoratorToggle', true );

    if ( vmo && vmo.props && vmo.props[resultProp] && vmo.props[resultProp].dbValues &&
        vmo.props[resultProp].dbValues.length > 0 && vmo.props[resultProp].dbValues[0] === '300' ) {
        return true;
    }

    return false;
};

//Color bar of object to show Caution status
export let applyResultYellowColourBar = function( vmo ) {
    let resultProp = getResultProperty();
    appCtxSvc.updatePartialCtx( 'decoratorToggle', true );
    if ( vmo && vmo.props && vmo.props[resultProp] && vmo.props[resultProp].dbValues &&
        vmo.props[resultProp].dbValues.length > 0 && vmo.props[resultProp].dbValues[0] === '500' ) {
        return true;
    }
    return false;
};

//Color bar of object to show Blocked status
export let applyResultOrangeColourBar = function( vmo ) {
    let resultProp = getResultProperty();
    appCtxSvc.updatePartialCtx( 'decoratorToggle', true );
    if ( vmo && vmo.props && vmo.props[resultProp] && vmo.props[resultProp].dbValues &&
        vmo.props[resultProp].dbValues.length > 0 && vmo.props[resultProp].dbValues[0] === '400' ) {
        return true;
    }
    return false;
};

/**
 * @param {Object} newColumnConfig New conlumn config returned by the SOA getTableViewModelProperties
 * @param {Object} uwDataProvider The Data Provider object
 */
export let updateVRPWATreeColumns = function( newColumnConfig, uwDataProvider ) {
    if ( uwDataProvider && newColumnConfig ) {
        uwDataProvider.columnConfig = newColumnConfig;

        for ( var idx = 0; idx < newColumnConfig.columns.length; ++idx ) {
            uwDataProvider.columnConfig.columns[idx].typeName = newColumnConfig.columns[idx].associatedTypeName;
        }
    }
};

export let initializeSelection = function( subPanelContext ) {
    var array = [];
    array.push( subPanelContext.openedObject );
    const tmpSelectionData = { ...subPanelContext.selectionData.value };
    tmpSelectionData.selected = array;
    subPanelContext.selectionData.update( tmpSelectionData );
};

/**
  *
  * @param {Object} selected selected
  * @returns{Object} navigationParams
  */
function _getSelectedObjectToOpen( selected ) {
    var navigationParams = {};
    if( selected && selected.objectToOpen ) {
        navigationParams.uid = selected.objectToOpen;
    } else if( appCtxSvc.ctx.selected && appCtxSvc.ctx.selected.props && appCtxSvc.ctx.selected.props.awb0UnderlyingObject ) {
        navigationParams.uid = appCtxSvc.ctx.selected.props.awb0UnderlyingObject.dbValues[ 0 ];
    } else if( appCtxSvc.ctx.selected.uid ) {
        navigationParams.uid = appCtxSvc.ctx.selected.uid;
    }
    return navigationParams;
}

export let openContentInNewTAB = function( selected ) {
    var navigationParams = _getSelectedObjectToOpen( selected );
    let action = {
        actionType: 'Navigate',
        navigateTo: 'com_siemens_splm_clientfx_tcui_xrt_showObject',
        navigateIn: 'newTab',
        navigationParams: navigationParams
    };
    navigationSvc.navigate( action, navigationParams );
};

export let openContentInNewWindow = function( selected ) {
    var navigationParams = _getSelectedObjectToOpen( selected );
    let action = {
        actionType: 'Navigate',
        navigateTo: 'com_siemens_splm_clientfx_tcui_xrt_showObject',
        navigateIn: 'newWindow',
        navigationParams: navigationParams
    };
    navigationSvc.navigate( action, navigationParams );
};
/**
  * Crt1VRSublocationService factory
  */
export default exports = {
    loadTreeTableColumns,
    loadTreeTableProperties,
    loadTreeTableData,
    syncSelections,
    initializeVRState,
    registerCtxSelection,
    setSelectionBackInPWA,
    applyResultRedColourBar,
    applyResultGreenColourBar,
    applyResultBlueColourBar,
    removeResultColourBar,
    updateVRPWATreeColumns,
    applyResultOrangeColourBar,
    applyResultYellowColourBar,
    initializeSelection,
    openContentInNewTAB,
    openContentInNewWindow
};

