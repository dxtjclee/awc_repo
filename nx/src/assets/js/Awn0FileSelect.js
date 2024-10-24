import appCtxSvc from 'js/appCtxService';
import hostOpenService from 'js/hosting/hostOpenService';
import soaSvc from 'soa/kernel/soaService';
import viewModelObjectService from 'js/viewModelObjectService';
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import awColumnSvc from 'js/awColumnService';
import treeTableDataService from 'js/treeTableDataService';
import awIconService from 'js/awIconService';
import _ from 'lodash';


var exports = {};
var objToOpen = null;
var previousDataProvider = null;

//policy override for properties for the tree table
var policyIOverride = {
    types: [ {
        name: 'WorkspaceObject',
        properties: [ {
            name: 'object_name'
        },
        {
            name: 'object_desc'
        },
        {
            name: 'awp0Item_item_id'
        },
        {
            name: 'item_revision_id'
        },
        {
            name: 'awb0ArchetypeRevLastModUser'
        },
        {
            name: 'last_mod_date'
        } ]
    }, {
        name: 'Folder',
        properties: [ {
            name: 'awp0HasChildren'
        } ]
    } ]
};

export let init = function() {
    //This is for supporting saved grid columns, not implemented just yet
    appCtxSvc.updateCtx( 'fileSelectGrid', {
        columnsToExclude: []
    } );
};

export let loadColumns = function() {
    var deferred = AwPromiseService.instance.defer();

    var awColumnInfos = [ {
        propertyName: 'object_name',
        displayName: 'Name',
        minWidth: 150,
        width: 250,
        isTreeNavigation: true,
        sortDirection: 'Ascending',
        enableColumnMoving:false
    },
    {
        name: 'awp0Item_item_id',
        displayName: 'ID',
        propertyName:'awp0Item_item_id',
        minWidth: 100,
        width: 150
    },
    {
        name: 'item_revision_id',
        displayName: 'Revision',
        propertyName:'item_revision_id',
        minWidth: 100
    },
    {
        name: 'object_desc',
        displayName: 'Description',
        propertyName:'object_desc',
        minWidth: 200
    },
    {
        name: 'awb0ArchetypeRevLastModUser',
        displayName: 'Last Modified User',
        propertyName: 'awb0ArchetypeRevLastModUser',
        minWidth:150
    },
    {
        name: 'last_mod_date',
        displayName: 'Last Modified Date',
        propertyName:'last_mod_date',
        minWidth: 100
    } ];

    awColumnSvc.createColumnInfo( awColumnInfos );

    deferred.resolve( {
        columnConfig: {
            columns: awColumnInfos,
            columnConfigId: 'gridView'
        }
    } );
    return deferred.promise;
};

/**
 * Create Callback function.
 *
 * @return {Object} A Object consisting of callback function.
 */
function getDataForUpdateColumnPropsAndNodeIconURLs() {
    var updateColumnPropsCallback = {};

    updateColumnPropsCallback.callUpdateColumnPropsAndNodeIconURLsFunction = function( propColumns, allChildNodes, contextKey, response ) {
        updateColumnPropsAndNodeIconURLs( propColumns, allChildNodes );
        return response.output.columnConfig;
    };

    return updateColumnPropsCallback;
}

/**
 * Function to update tree table columns props and icon urls
 * @param {Object} propColumns Contains prop columns
 * @param {Object} childNodes Contains tree nodes
 */
function updateColumnPropsAndNodeIconURLs( propColumns, childNodes ) {
    _.forEach( propColumns, function( col ) {
        if( !col.typeName && col.associatedTypeName ) {
            col.typeName = col.associatedTypeName;
        }
    } );
    propColumns[ 0 ].enableColumnMoving = false;
    var _firstColumnPropertyName = propColumns[ 0 ].propertyName;

    _.forEach( childNodes, function( childNode ) {
        childNode.iconURL = awIconService.getTypeIconFileUrl( childNode );
        treeTableDataService.updateVMODisplayName( childNode, _firstColumnPropertyName );
    } );
}

export let loadTreeTablePropertiesOnInitialLoad = function( vmNodes, declViewModel, uwDataProvider, context, contextKey ) {
    var updateColumnPropsCallback = getDataForUpdateColumnPropsAndNodeIconURLs();
    return AwPromiseService.instance.resolve( treeTableDataService.loadTreeTablePropertiesOnInitialLoad( vmNodes, declViewModel, uwDataProvider, context, contextKey, updateColumnPropsCallback ) );
};

export let loadTableData = function( parentNode, sortCriteria ) {
    let deferred = AwPromiseService.instance.defer();

    //Home node is the top node, so our first call should use the home node
    if( parentNode !== null && parentNode.uid === 'top' ) {
        parentNode = cdm.getObject( appCtxSvc.ctx.user.props.home_folder.dbValues[0] );
        parentNode.levelNdx = -1;
    }

    //Soa call to get children of the expanded object
    soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: 'Awp0ObjectNavigation'
        },
        searchInput: {
            attributesToInflate: [],
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Awp0ObjectSetRowProvider',
            searchCriteria: {
                objectSet:'contents.WorkspaceObject',
                parentUid: parentNode.uid,
                returnTargetObjs: 'true',
                showConfiguredRev: 'true'
            },
            startIndex: 0
        },
        inflateProperties: false,
        noServiceData: false
    }, policyIOverride )
        .then( ( response ) =>{
            response = buildResponse( response );

            if( sortCriteria && sortCriteria.length > 0 ) {
                response.searchResults = sortResults( response.searchResults, sortCriteria );
            }

            var treeLoadResultReturn = buildTree( response.searchResults, parentNode );
            treeLoadResultReturn.columnConfig = response.columnConfig;
            deferred.resolve(
                {
                    treeLoadResult: treeLoadResultReturn
                }
            );
        } );

    return deferred.promise;
};

//parse the response and build vmo objects out of the objects for the treeloadResult
function buildResponse( response ) {
    response.searchResults = JSON.parse( response.searchResultsJSON );

    response.searchResults = response.searchResults &&
        response.searchResults.objects ? response.searchResults.objects
            .map( function( vmo ) {
                return viewModelObjectService
                    .createViewModelObject( vmo.uid, 'EDIT', null, vmo );
            } ) : [];

    return response;
}

function sortResults( results, sortCriteria ) {
    let criteria = sortCriteria[ 0 ];
    let sortDirection = criteria.sortDirection;
    let sortColName = criteria.fieldName;

    if( sortDirection === 'ASC' ) {
        results.sort( function( a, b ) {
            if( a.props[sortColName] !== null && b.props[sortColName] !== null && a.props[ sortColName ].value <= b.props[ sortColName ].value ) {
                return -1;
            }
            return 1;
        } );
    } else if( sortDirection === 'DESC' ) {
        results.sort( function( a, b ) {
            if( a.props[sortColName] === null || b.props[sortColName] === null || a.props[ sortColName ].value >= b.props[ sortColName ].value ) {
                return -1;
            }
            return 1;
        } );
    }

    return results;
}

function buildTree( arrayOfObjects, parentNode ) {
    var treeData = arrayOfObjects;

    //Trees need specific properties, this foreach loop adds those properties
    treeData.forEach( element => {
        element.levelNdx = parentNode.levelNdx + 1;
        element.isLeaf = !containsChildren( element );
        element.displayName = element.props.object_name.dbValues[0];
    } );

    //Return the object that will become the treeloadResult
    return {
        parentNode: parentNode,
        childNodes: treeData,
        totalChildCount: treeData.length,
        searchResults: treeData,
        startChildNdx: 0
    };
}

//Checks if the vmoObj contains any children, used to check if an obj is a leaf
function containsChildren( vmoObj ) {
    if( vmoObj.props && vmoObj.props.awp0HasChildren && vmoObj.props.awp0HasChildren.dbValues[0] === '1' ) {
        return true;
    }
    return false;
}

//when one panels item is selected, this deselects items from other panels
export let handleSelectionChange = function( dataProvider ) {
    //This occurs when the selectNone is called below. The selectNone shouldn't actually do anything
    if ( previousDataProvider &&
        dataProvider.dataProviderName !== previousDataProvider.dataProviderName &&
        dataProvider.selectedObjects &&
        dataProvider.selectedObjects.length === 0 ) {
        return;
    }

    //The actual selection
    if( dataProvider.selectedObjects && dataProvider.selectedObjects.length > 0 && dataProvider.selectedObjects[0].type === 'ItemRevision' ) {
        objToOpen = dataProvider.selectedObjects[0];
    } else{
        objToOpen = null;
    }

    //Deselecting items under other panels
    if ( previousDataProvider !== null && previousDataProvider !== undefined &&
         previousDataProvider.dataProviderName !== dataProvider.dataProviderName ) {
        previousDataProvider.selectionModel.selectNone();
    }
    //Make sure to keep track of the old panel for deselection later
    previousDataProvider = dataProvider;

    appCtxSvc.updateCtx( 'selected', objToOpen );
};

export let cancelSelection = function() {
    //Needs to be redone to interact with SWF3D instead
};

export let selectInHost = function() {
    if( objToOpen !== null ) {
        //For right now changing the uid to match one that we know is present on swf
        //objToOpen.uid = "yrRNNSAmx6sBFD";
        hostOpenService.openInHost( objToOpen );
    }
};

export default exports = {
    selectInHost,
    loadTableData,
    loadColumns,
    init,
    handleSelectionChange,
    cancelSelection,
    loadTreeTablePropertiesOnInitialLoad
};
