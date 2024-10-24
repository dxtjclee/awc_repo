// Copyright (c) 2023 Siemens

/**
 * @module js/substituteGroupService
 */
import addObjectUtils from 'js/addObjectUtils';
import awPromiseService from 'js/awPromiseService';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';
import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import dmSvc from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import iconSvc from 'js/iconService';
import logger from 'js/logger';
import msgSvc from 'js/messagingService';
import occmgmtBackingObjectProviderSvc from 'js/occmgmtBackingObjectProviderService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import parsingUtils from 'js/parsingUtils';
import soaSvc from 'soa/kernel/soaService';
import tcVmoService from 'js/tcViewModelObjectService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import _ from 'lodash';

let exports = {};
const clientScopeURI = 'awb0SubstituteGroup';
const SubstituteGroup = 'Fnd0SubstituteGroup';
const Substitutes = 'Substitutes';
const Elements = 'Elements';
const Folder = 'Folder';

let IModelObject = function( uid, type ) {
    this.uid = uid;
    this.type = type;
};

/**
* Get substitute group data for the selected element.

* @param {treeLoadInput} treeLoadInput Tree Load Input
* @param {subPanelContext} subPanelContext
* @param {data} the view model data
* @return {Promise} Resolved with an object containing the results of the operation.
*/
export let loadSubstituteGroupTree = function( treeLoadInput, sortCriteria, columnFilters, subPanelContext ) {
    let deferred = awPromiseService.instance.defer();
    let selectedUid = subPanelContext.selected.uid;
    treeLoadInput.displayMode = 'Tree';

    let soaInput = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: clientScopeURI
        },
        inflateProperties: true,
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Awb0SubstitutesProvider',
            searchFilterMap6: {},
            searchCriteria: {
                selectedElement: selectedUid,
                usecase: 'ShowAllSubstitutesAndSubstituteGroups'
            },
            searchFilterFieldSortType: 'Alphabetical',
            searchSortCriteria: [],
            columnFilters: columnFilters,
            sortCriteria: sortCriteria

        }
    };

    buildTreeTableStructure( treeLoadInput, soaInput, deferred );
    return deferred.promise;
};

/**
* Get substitute group data for the next action. This will be called when the Elements Node under the SubstituteGroup is expanded
* @param {treeLoadInput} treeLoadInput Tree Load Input
* @param {subPanelContext} subPanelContext
* @return {Promise} Resolved with an object containing the results of the operation.
*/
export let loadNextSubstituteGroupTree = function( treeLoadInput, subPanelContext ) {
    let deferred = awPromiseService.instance.defer();
    buildNextTreeTableStructure( treeLoadInput, subPanelContext, deferred );
    return deferred.promise;
};


function buildTreeTableStructure( treeLoadInput, soaInput, deferred ) {
    // set policy
    let policyJson = {
        types: [ {
            name: SubstituteGroup,
            properties: [ {
                name: 'fnd0substituteList',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            }
            ]
        },
        {
            name: 'ItemRevision',
            properties: [ {
                name: 'owning_user'
            },
            {
                name: 'owning_group'
            },
            {
                name: 'object_type'
            }
            ]
        },
        {
            name: 'Item',
            properties: [ {
                name: 'owning_user'
            },
            {
                name: 'owning_group'
            },
            {
                name: 'object_type'
            }
            ]
        } ]
    };

    let policyId = propertyPolicySvc.register( policyJson );
    return soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then(
        function( response ) {
            if ( policyId ) {
                propertyPolicySvc.unregister( policyId );
            }

            let retrievingFirstLevel = treeLoadInput.parentNode.levelNdx === -1;
            let columnConfig = {};
            if ( retrievingFirstLevel ) {
                columnConfig = initColumsForSubstituteGroupTable( response.columnConfig );
            }
            let endReachedlet = response.totalLoaded >= response.totalFound;
            let startReachedlet = treeLoadInput.startChildNdx <= 0;

            let tempCursorObject = {
                endReached: endReachedlet,
                startReached: startReachedlet
            };

            let searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
            let viewModeolObjectsFromJson = [];
            _.forEach( searchResults.objects, function( object ) {
                viewModeolObjectsFromJson.push( object );
            } );

            let treeLoadResult = createViewModelTreeNode( treeLoadInput, viewModeolObjectsFromJson, startReachedlet, endReachedlet );
            treeLoadResult.parentNode.cursorObject = tempCursorObject;
            if ( treeLoadResult.childNodes.length > 0 ) {
                treeLoadResult.childNodes[0].parentUid = soaInput.searchInput.searchCriteria.parentUid;
            }
            treeLoadResult.columnConfig = columnConfig;

            deferred.resolve( {
                treeLoadResult: treeLoadResult,
                clientScopeURI: clientScopeURI,
                objectSetUri: response.columnConfig.columnConfigId
            } );
        } );
}

function buildNextTreeTableStructure( treeLoadInput, subPanelContext, deferred ) {
    if ( cmm.isInstanceOf( SubstituteGroup, treeLoadInput.parentNode.modelType ) ) {
        let substitutetUid = Substitutes + treeLoadInput.parentNode.uid;
        let modelObjectSubstitute = new IModelObject( substitutetUid, 'unknownType' );
        cdm.setCache( modelObjectSubstitute );
        let childNdx = 1;
        let iconURL = iconSvc.getTypeIconURL( Folder );
        let treeVmNodeSubstitute = awTableTreeSvc.createViewModelTreeNode( modelObjectSubstitute.uid, Substitutes, Substitutes, treeLoadInput.parentNode.levelNdx + 1, childNdx, iconURL );
        treeVmNodeSubstitute.props = {
            object_string: {
                uiValues: [ Substitutes ]
            }

        };
        treeVmNodeSubstitute.id = treeVmNodeSubstitute.id + treeLoadInput.parentNode.id + childNdx + treeLoadInput.parentNode.levelNdx;
        treeVmNodeSubstitute.fnd0substituteList = treeLoadInput.parentNode.props.fnd0substituteList;
        treeVmNodeSubstitute.parentNode = treeLoadInput.parentNode;
        let modelParentObj = cdm.getObject( treeLoadInput.parentNode.uid );
        treeVmNodeSubstitute.parentNode = modelParentObj;
        treeVmNodeSubstitute.fnd0SubstituteGroupObj = modelParentObj;
        treeVmNodeSubstitute.isLeaf = true;
        if ( modelParentObj.props.fnd0substituteList.dbValues.length > 0 ) {
            treeVmNodeSubstitute.isLeaf = false;
        }
        let vmNodes = [];
        vmNodes.push( treeVmNodeSubstitute );
        let startReachedlet = true;
        let endReachedlet = true;
        let elementsUid = Elements + treeLoadInput.parentNode.uid;
        let modelObjectElement = new IModelObject( elementsUid, 'unknownType' );
        let treeVmNodeElement = awTableTreeSvc.createViewModelTreeNode( modelObjectElement.uid, Elements, Elements, treeLoadInput.parentNode.levelNdx + 1, childNdx, iconURL );
        treeVmNodeElement.props = {
            object_string: {
                uiValues: [ Elements ]
            }

        };

        treeVmNodeElement.id = treeVmNodeElement.id + treeLoadInput.parentNode.id + childNdx + treeLoadInput.parentNode.levelNdx;
        treeVmNodeElement.fnd0substituteList = treeLoadInput.parentNode.props.fnd0substituteList;
        treeVmNodeElement.parentNode = modelParentObj;
        treeVmNodeElement.fnd0SubstituteGroupObj = modelParentObj;
        treeVmNodeElement.isLeaf = false;

        vmNodes.push( treeVmNodeElement );
        let treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, startReachedlet, endReachedlet, null );
        deferred.resolve( {
            treeLoadResult: treeLoadResult,
            clientScopeURI: clientScopeURI
        } );
    } else if ( treeLoadInput.parentNode.type === Substitutes ) {
        let vmNodes = [];
        _.forEach( treeLoadInput.parentNode.fnd0substituteList.dbValues, function( fnd0Substitute ) {
            let modelobj = cdm.getObject( fnd0Substitute );
            let childNdx = 1;
            let treeVmNode = awTableTreeSvc.createViewModelTreeNode( modelobj.uid, modelobj.type, modelobj.props.object_string.uiValues[0], treeLoadInput.parentNode.levelNdx + 1, childNdx, null );
            tcVmoService.mergeObjects( treeVmNode, modelobj );
            treeVmNode.id = treeVmNode.id + treeLoadInput.parentNode.id + childNdx + treeLoadInput.parentNode.levelNdx;
            treeVmNode.alternateID = treeVmNode.id;
            treeVmNode.isLeaf = true;
            treeVmNode.fnd0SubstituteGroupObj = treeLoadInput.parentNode.fnd0SubstituteGroupObj;
            treeVmNode.parentNode = treeLoadInput.parentNode;
            vmNodes.push( treeVmNode );
        } );

        let treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, true, true, null );

        return deferred.resolve( {
            treeLoadResult: treeLoadResult
        } );
    } else if ( treeLoadInput.parentNode.type === Elements ) {
        let soaInput = {
            columnConfigInput: {
                clientName: 'AWClient',
                clientScopeURI: clientScopeURI
            },
            inflateProperties: true,
            searchInput: {
                maxToLoad: 50,
                maxToReturn: 50,
                providerName: 'Awb0SubstitutesProvider',
                searchFilterMap6: {},
                searchCriteria: {
                    selectedElement: subPanelContext.selected.uid,
                    substituteGroup: treeLoadInput.parentNode.fnd0SubstituteGroupObj.uid,
                    usecase: 'ExpandElementsInSubstituteGroup'
                },
                searchFilterFieldSortType: 'Alphabetical'
            }
        };

        buildTreeTableStructure( treeLoadInput, soaInput, deferred );
        return deferred.promise;
    }
}

function createViewModelTreeNode( treeLoadInput, viewModeolObjectsFromJson, startReachedlet, endReachedlet ) {
    let vmNodes = [];
    let parentNode = treeLoadInput.parentNode;
    let levelNdx = parentNode.levelNdx + 1;
    treeLoadInput.pageSize = viewModeolObjectsFromJson.length;
    for ( let childNdx = 0; childNdx < viewModeolObjectsFromJson.length; childNdx++ ) {
        let proxyObject = viewModeolObjectsFromJson[childNdx];
        let endObjectVmo = viewModelObjectSvc.createViewModelObject( proxyObject.uid, 'EDIT', proxyObject.uid, proxyObject );
        let iconURL = iconSvc.getTypeIconURL( endObjectVmo.type );
        let treeVmNode = awTableTreeSvc.createViewModelTreeNode( endObjectVmo.uid, endObjectVmo.type, endObjectVmo.props.object_string.uiValues[0], levelNdx, childNdx, iconURL );
        treeVmNode.id = treeVmNode.id + treeLoadInput.parentNode.id + childNdx + treeLoadInput.parentNode.levelNdx;
        treeVmNode.alternateID = treeVmNode.id;
        treeVmNode.isLeaf = true;
        if ( cmm.isInstanceOf( SubstituteGroup, endObjectVmo.modelType ) ) {
            treeVmNode.isLeaf = false;
        }

        tcVmoService.mergeObjects( treeVmNode, endObjectVmo );
        if ( treeLoadInput.parentNode.type === Elements ) {
            treeVmNode.fnd0SubstituteGroupObj = treeLoadInput.parentNode.fnd0SubstituteGroupObj;
            treeVmNode.parentNode = treeLoadInput.parentNode;
        }

        if ( treeVmNode ) {
            vmNodes.push( treeVmNode );
        }
    }

    return awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, startReachedlet, endReachedlet, null );
}

/**
 * Build column information for SubstituteGroup Table.
 *
 * @param {ColumConfi} columnConfig - Column config returned by SOA
 * @param {UwDataProvider} dataProvider - The data provider for SubstituteGroupTable
 *
 */
function initColumsForSubstituteGroupTable( columnConfig ) {
    let awColumnInfos = [];
    let columnConfigCols = columnConfig.columns;
    for ( let index = 0; index < columnConfigCols.length; index++ ) {
        let pixelWidth = columnConfigCols[index].pixelWidth;
        let columnInfo = {
            field: columnConfigCols[index].propertyName,
            name: columnConfigCols[index].propertyName,
            propertyName: columnConfigCols[index].propertyName,
            displayName: columnConfigCols[index].displayName,
            typeName: columnConfigCols[index].assosiatedTypeName,
            pixelWidth: pixelWidth,
            hiddenFlag: columnConfigCols[index].hiddenFlag,
            enableColumnResizing: true,
            pinnedRight: false,
            enablePinning: false,
            enableCellEdit: false
        };
        let awColumnInfo = awColumnSvc.createColumnInfo( columnInfo );
        awColumnInfos.push( awColumnInfo );
    }

    return {
        columnConfigId: columnConfig.columnConfigId,
        columns: awColumnInfos
    };
}


/**
 * Gets the created object from createInterchangeableGroups SOA response. Returns Fnd0SubstituteGroup
 *
 * @param {Object} response - the response of createInterchangeableGroups SOA call
 * @param {StringArray} validTypes - valid types
 * @return {Object} the created object
 */
export let getCreatedObject = function( response ) {
    if ( !_.isUndefined( response.created ) ) {
        return response.created[0];
    }
};


/**
 * Get input data for object creation SOA - > createInterchangeableGroups
 *
 * @param {subPanelContext} subPanelContext
 * @param {Object} data - the view model data object
 * @return {Object} create input
 */
export let getCreateInput = function( subPanelContext, data, creationType, editHandlerIn ) {
    let createInput = addObjectUtils.getCreateInput( data, null, creationType, editHandlerIn );
    let sourceObjs = [];
    for ( let i = 0; i < subPanelContext.occContext.selectedModelObjects.length; i++ ) {
        sourceObjs.push( subPanelContext.occContext.selectedModelObjects[i] );
    }

    // ToDO call async function here
    const response = occmgmtBackingObjectProviderSvc.getBackingObjects( sourceObjs );
    let backingObjs = [];
    let targetObjs = [];
    let fnd0substituteList = createInput[0].createData.propertyNameValues.fnd0substituteList;
    if ( !_.isUndefined( fnd0substituteList ) ) {
        for ( let i = 0; i < fnd0substituteList.length; i++ ) {
            let modelobj = cdm.getObject( fnd0substituteList[i] );
            targetObjs.push( modelobj );
        }
    }

    let propertyNameValues = createInput[0].createData.propertyNameValues;
    Object.keys( propertyNameValues ).forEach( key => {
        propertyNameValues[key] = propertyNameValues[key][0];
    } );

    return [ {
        interChangeableObjs: targetObjs,
        objectType: 'Fnd0SubstituteGroup',
        props: propertyNameValues,
        sourceObjs: backingObjs
    } ];
};

/**
 * Get input data to set the property fnd0substituteList on SubstituteGroup
 *
 * @param {Object} data the view model data object
 * @return {Object} setProperties Input
 */
export let getSubstituteGroupSetInput = function( data ) {
    let input = [];
    let obj = data.ctx.mselected[0].fnd0SubstituteGroupObj;
    let existingData = data.ctx.mselected[0].fnd0SubstituteGroupObj.props.fnd0substituteList.dbValues;
    let newData = _.cloneDeep( existingData );
    if ( !_.isUndefined( data.createdObject ) ) {
        newData.push( data.createdObject.uid );
    } else {
        for ( let idx in data.substitutes ) {
            newData.push( data.substitutes[idx].uid );
        }
    }

    newData = _.uniq( newData );
    let dataVal = {
        object: obj,
        vecNameVal: [ {
            name: 'fnd0substituteList',
            values: newData
        } ]
    };
    input.push( dataVal );
    return input;
};

/**
 * Reload SubstituteGroupTable
 * @param {data} the view model data
 */
export let reloadsubstituteGroupTable = function( data ) {
    data.dataProviders.substituteGroupDataProvider.selectionModel.selectNone();
    data.dataProviders.substituteGroupDataProvider2.selectionModel.selectNone();
    eventBus.publish( 'reloadsubstituteGroupGrid' );
    eventBus.publish( 'reloadsubstituteGroupGrid2' );
};

/**
 * Remove Substitutes From SubstituteGroup
 *
 * @param {treeSelection} selected Object
 * @return {Object} setProperties Output
 */
export let removeSubstitutesFromSubstituteGroup = function( treeSelection ) {
    let deferred = awPromiseService.instance.defer();
    let input = [];
    let obj = treeSelection[0].fnd0SubstituteGroupObj;
    let existingData = treeSelection[0].fnd0SubstituteGroupObj.props.fnd0substituteList.dbValues;
    let newData = _.cloneDeep( existingData );

    newData = newData.filter( function( item ) {
        return item !== treeSelection[0].uid;
    } );

    let dataVal = {
        object: obj,
        vecNameVal: [ {
            name: 'fnd0substituteList',
            values: newData
        } ]
    };

    dmSvc.setProperties( [ dataVal ] ).then( function() {
        eventBus.publish( 'reloadsubstituteGroupTable' );
        deferred.resolve();
    } ).catch( function( error ) {
        let errMessage = msgSvc.getSOAErrorMessage( error );
        msgSvc.showError( errMessage );
        logger.error( 'error occured setting property fnd0substituteList' );
        deferred.reject( error );
    } );

    return deferred.promise;
};

/**
 * Remove Elements From SubstituteGroup
 *
 * @param {pwaSelection} primary Work Area Selected Object
 * @param {treeSelection} selected Object in SubstituteGroup Tree
 * @return {Object} setProperties Output
 */
export let removeElementsFromSubstituteGroup = function( pwaSelection, treeSelection ) {
    let deferred = awPromiseService.instance.defer();
    let soaInput = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: 'awb0Structure'
        },
        searchInput: {
            maxToLoad: 1,
            maxToReturn: 1,
            providerName: 'Awb0SubstitutesProvider',
            searchCriteria: {
                itemRevision: treeSelection[0].uid,
                substituteGroup: treeSelection[0].fnd0SubstituteGroupObj.uid,
                selectedElement: pwaSelection.uid,
                usecase: 'RemoveItemRevisionFromSubstituteGroup'

            },
            startIndex: 0
        }
    };
    // set policy
    let policyJson = {
        types: [ {
            name: 'BOMLine',
            properties: [ {
                name: 'fnd0bl_substitute_groups'

            },
            {
                name: 'bl_window'

            }
            ]
        } ]
    };

    let policyId = propertyPolicySvc.register( policyJson );
    soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then(
        function( response ) {
            if ( policyId ) {
                propertyPolicySvc.unregister( policyId );
            }
            if ( response.searchResultsJSON ) {
                response.searchResults = JSON.parse( response.searchResultsJSON );
                delete response.searchResultsJSON;
                let newData = [];
                for ( let inx = 0; inx < response.searchResults.objects.length; inx++ ) {
                    let bomlLine = response.searchResults.objects[inx];
                    let bomlLineObj = cdm.getObject( bomlLine.uid );
                    let existingData = bomlLineObj.props.fnd0bl_substitute_groups.dbValues;
                    newData = _.cloneDeep( existingData );
                }
                newData = newData.filter( function( item ) {
                    return item !== treeSelection[0].fnd0SubstituteGroupObj.uid;
                } );
                let dataVal = {
                    object: response.searchResults.objects[0],
                    vecNameVal: [ {
                        name: 'fnd0bl_substitute_groups',
                        values: newData
                    } ]
                };

                dmSvc.setProperties( [ dataVal ] ).then( function() {
                    eventBus.publish( 'reloadsubstituteGroupTable' );
                    deferred.resolve();
                } ).then( function() {
                    let bomlLine = response.searchResults.objects[0];
                    let bomlLineObj = cdm.getObject( bomlLine.uid );
                    let bomWindows = [];
                    bomWindows[0] = {
                        uid: bomlLineObj.props.bl_window.dbValues[0],
                        type: 'BOMWindow'
                    };
                    let blWindowObject = {
                        bomWindows: bomWindows
                    };
                    soaSvc.post( 'Cad-2008-06-StructureManagement', 'saveBOMWindows', blWindowObject ).then( function( response ) {
                    }, function( error ) {
                        let errMessage = msgSvc.getSOAErrorMessage( error );
                        msgSvc.showError( errMessage );
                    } );
                }


                ).catch( function( error ) {
                    let errMessage = msgSvc.getSOAErrorMessage( error );
                    msgSvc.showError( errMessage );
                    logger.error( 'error occured setting property fnd0bl_substitute_groups' );
                    deferred.reject( error );
                } );

                return deferred.promise;
            }
        } );
};


/**
 * set the gridId for the Table
 * @param {subPanelContext} subPanelContext
 */
export let setViewConfig = function( subPanelContext ) {
    let gridId = '';
    if ( subPanelContext && subPanelContext.context && subPanelContext.context.contextKey === 'occmgmtContext' ) {
        gridId = 'substituteGroupGrid';
    } else {
        gridId = 'substituteGroupGrid2';
    }
    return {
        gridId: gridId,
        contextKey: subPanelContext.context.contextKey
    };
};

/**
 * getPropertiesInput for setting ptoperty on bomline
 * @param {data} the view model data
 */
export let getPropertiesInput = function( substituteGroup, inputBomLines ) {
    let input = [];
    if ( inputBomLines ) {
        for ( let inx = 0; inx < inputBomLines.length; inx++ ) {
            let bomlLine = inputBomLines[inx];
            let bomlLineObj = cdm.getObject( bomlLine.uid );
            let existingData = bomlLineObj.props.fnd0bl_substitute_groups.dbValues;
            let newData = _.cloneDeep( existingData );
            newData.push( substituteGroup );
            let dataVal = {
                object: bomlLine,
                vecNameVal: [ {
                    name: 'fnd0bl_substitute_groups',
                    values: newData
                } ]
            };
            input.push( dataVal );
        }
    }
    return input;
};
/**
 * get properties for input bomlines
 *
 * @param {inputBomLines} input Bom Lines.
 */
export let getPropertiesInputUIDs = function( inputBomLines ) {
    var getPropertiesInput = [];

    for( var selCount = 0; selCount < inputBomLines.length; selCount++ ) {
        var charGroup = {
            type: inputBomLines[ selCount ].type,
            uid: inputBomLines[ selCount ].uid
        };
        getPropertiesInput.push( charGroup );
    }

    return getPropertiesInput;
};

/**
 * Method to handle when Delta Response is true with No change in PWA. We need to reload the substituteGroups
 * @param {object} eventMap Event Map
 */
export const handleConfigurationChange = ( eventMap ) => {
    const eventData = eventMap[ 'cdm.relatedModified' ];
    if( eventData?.forceReloadAceSWA === true ) {
        eventBus.publish( 'reloadsubstituteGroupTable' );
    }
};


let updateHiddenCommandContextForSubstituteGroup = function( value ) {
    let hiddenCommandCtx = appCtxSvc.getCtx( 'hiddenCommands' );
    if ( !hiddenCommandCtx ) {
        hiddenCommandCtx = {};
    }
    if ( value ) {
        hiddenCommandCtx.Awb0AddChildElement = value;
        hiddenCommandCtx.Awb0AddSiblingElement = value;
        hiddenCommandCtx.awb0SplitRootCmd = value;
        hiddenCommandCtx.Awb0ContentCompareMsm = value;
    } else {
        delete hiddenCommandCtx.Awb0AddChildElement;
        delete hiddenCommandCtx.Awb0AddSiblingElement;
        delete hiddenCommandCtx.awb0SplitRootCmd;
        delete hiddenCommandCtx.Awb0ContentCompareMsm;
    }
    appCtxSvc.updatePartialCtx( 'hiddenCommands', hiddenCommandCtx );
};

export default exports = {
    handleConfigurationChange,
    loadSubstituteGroupTree,
    loadNextSubstituteGroupTree,
    getCreatedObject,
    getCreateInput,
    getSubstituteGroupSetInput,
    getPropertiesInput,
    getPropertiesInputUIDs,
    reloadsubstituteGroupTable,
    removeElementsFromSubstituteGroup,
    removeSubstitutesFromSubstituteGroup,
    setViewConfig,
    updateHiddenCommandContextForSubstituteGroup

};
