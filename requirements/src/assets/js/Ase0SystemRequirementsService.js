// Copyright (c) 2022 Siemens

/**
 * @module js/Ase0SystemRequirementsService
 */
import utilSvc from 'js/Ase0SystemReqUtilService';
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import awTableSvc from 'js/awTableService';
import iconSvc from 'js/iconService';
import tcVmoService from 'js/tcViewModelObjectService';
import policySvc from 'soa/kernel/propertyPolicyService';
import editHandlerSvc from 'js/editHandlerService';
import selectionService from 'js/selection.service';
import listBoxService from 'js/listBoxService';
import uwPropertyService from 'js/uwPropertyService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import parsingUtils from 'js/parsingUtils';
import browserUtils from 'js/browserUtils';
import fmsUtils from 'js/fmsUtils';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';

/* eslint-disable complexity */

var exports = {};

var _attrAlignmentProxyObjects = [];
var _treeColumnInfos = [];
var _searchFilterMap = {};

var _attMappingTable = false;
var _fixAttMappingTableHeight = false;
var _reqElementType = 'Requirement';
var _defaultIconURL = '';
var _defaultGroupIconURL = '';

var _propMap = {};
var _propDisplayMap = {};
var _emptyProp = null;

var _isMappingTableEditing = 'isMappingTableEditing';

var _newLink = null;

/**
 * Init page
 * @param {Object} ctx appCtx
 */
export let initPage = function( ctx, data ) {
    // Disable "Add > Sibling" visibility for parent-less requirements
    var reqCtx = { StructureDisplayModeContext: 'NestedDisplay' };
    appCtxSvc.updateCtx( 'StructureDisplayModeContext', reqCtx );

    var reqTLCtx = { selection: [] };
    appCtxSvc.updateCtx( 'Ase0SystemRequirementsSelection', reqTLCtx );

    var splitReqCtx = appCtxSvc.getCtx( 'SystemRequirements' );

    // Initialize ctx for Attributes table
    if(  splitReqCtx.pageSplit === 'attr' || splitReqCtx.pageSplit === 'all'  ) {
        _attMappingTable = true;

        var selection = selectionService.getSelection();
        var selectedObjs = selection.selected;

        var selModelObj = null;
        var mappingCmd = 'true';

        if( selectedObjs.length > 0 && selectedObjs[ 0 ].props && selectedObjs[ 0 ].props.awb0UnderlyingObject ) {
            selModelObj = cdm.getObject( selectedObjs[ 0 ].props.awb0UnderlyingObject.dbValues[ 0 ] );
        }

        if( selModelObj && selModelObj.modelType && selModelObj.modelType.typeHierarchyArray.indexOf( 'SpecElementRevision' ) > -1 ) {
            mappingCmd = 'false';
        }

        var attrContext = appCtxSvc.getCtx( 'Att1ShowMappedAttribute' );

        if( !attrContext ) {
            attrContext = {};
        }

        attrContext.clientName = 'AWClient';
        attrContext.clientScopeURI = 'AttributeMappingTable';
        attrContext.parentUids = selectedObjs[ '0' ].uid;
        attrContext.rootElementUids = exports.getRootElementUids();
        attrContext.productContextUids = exports.getProductContextUids();
        attrContext.mappingCommand = mappingCmd;
        attrContext.connectionInfo = '';

        appCtxSvc.updateCtx( 'Att1ShowMappedAttribute', attrContext );

        // Initialize Editing Context
        appCtxSvc.updateCtx( _isMappingTableEditing, false );
    } else {
        var attrContext1 = {
            clientName: 'AWClient',
            clientScopeURI: 'AttributeMappingTable',
            parentUids: '',
            rootElementUids: '',
            productContextUids: '',
            connectionInfo: ''
        };
        appCtxSvc.updateCtx( 'Att1ShowMappedAttribute', attrContext1 );
    }
};

/**
 * initialize the correct split value. The default split is all; unless the attributes table is hidden.
 * @param {Object} subPanelContext sub panel context if any
 */
export let initializePageSplit = function( subPanelContext ) {
    let reqSplitCtx = appCtxSvc.getCtx( 'SystemRequirements' );
    let updateCtx = false;

    if( !reqSplitCtx ) {
        reqSplitCtx = {
            pageSplit: 'all',
            enableAttributes: false
        };
        updateCtx = true;
    }
    var processChildren = subPanelContext !== null &&
    typeof subPanelContext !== 'undefined' &&
    subPanelContext.processRelation === 'CHILD';

    if( reqSplitCtx.enableAttributes !== processChildren ) {
        reqSplitCtx.enableAttributes = processChildren;
        updateCtx = true;
    }

    if( ( !appCtxSvc.getCtx( 'aceActiveContext' ) || !reqSplitCtx.enableAttributes ) &&
        ( reqSplitCtx.pageSplit === 'attr' || reqSplitCtx.pageSplit === 'all' ) ) {
        reqSplitCtx.pageSplit = 'doc';
        updateCtx = true;
    }


    if( updateCtx ) {
        appCtxSvc.updateCtx( 'SystemRequirements', reqSplitCtx );
    }
};


/**
 * Update the panel sizes
 *
 * @param {Object} ctx app context
 * @param {Object} eventData event data
 */
export let updatePanelSizes = function( ctx, eventData ) {
    return;
};

/**
 * Method to return the UID of the selected object.
 *
 * @param {Object} selected selected
 * @returns{Object} elementUID UID of the selected element.
 */
export let getElementUid = function( selected ) {
    var elementUID = '';
    if( selected && selected.uid ) { elementUID = selected.uid; }
    return elementUID;
};

/**
 * get the current product context uid or return empty string
 *
 * @param {Object} ctx context object
 * @returns {String} uid of product context element or empty string
 */
export let getCurrentProductContextUid = function( ctx ) {
    return _.get( ctx, 'occmgmtContext.productContextInfo.uid', '' );
};

export let getTopElement = function( node ) {
    if( node && node.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        var loop = true;
        while( loop ) {
            if( node.props.awb0Parent && node.props.awb0Parent.dbValues[ 0 ] ) {
                node = cdm.getObject( node.props.awb0Parent.dbValues[ 0 ] );
            } else {
                loop = false;
            }
        }
    }
    return node;
};

/**
 * get the current root element uid or return empty string
 *
 * @param { Object } selectedNode context object
 * @returns {String} uid of root element or empty string
 */
export let getCurrentRootElementUid = function( selectedNode ) {
    if( selectedNode !== undefined ) {
        var topNode = getTopElement( selectedNode );
        if( topNode ) {
            return topNode.uid;
        }
    }
    return '';
};

/**
 * getRootElementUids
 * @return {String} return root element uid
 */
export let getRootElementUids = function() {
    var rString = '';

    var elementToPCIMap = appCtxSvc.ctx.occmgmtContext && appCtxSvc.ctx.occmgmtContext.elementToPCIMap;

    if( elementToPCIMap ) {
        var uids = [];
        uids = Object.keys( elementToPCIMap );

        for( var x = 0; x < uids.length; ++x ) {
            rString += uids[ x ];

            if( x < uids.length - 1 ) {
                rString += ' ';
            }
        }
    } else {
        rString = appCtxSvc.ctx.occmgmtContext && appCtxSvc.ctx.occmgmtContext.topElement && appCtxSvc.ctx.occmgmtContext.topElement.uid || '';
    }

    return rString;
};

/**
 * getProductContextUids
 *
 * @returns {String} uid of product context
 */
export let getProductContextUids = function() {
    var rString = '';

    if( appCtxSvc.ctx.occmgmtContext ) {
        var elementToPCIMap = appCtxSvc.ctx.occmgmtContext.elementToPCIMap;

        if( elementToPCIMap ) {
            var uids = [];
            for( var i in elementToPCIMap ) {
                if( elementToPCIMap.hasOwnProperty( i ) ) {
                    uids.push( elementToPCIMap[ i ] );
                }
            }

            for( var x = 0; x < uids.length; ++x ) {
                rString += uids[ x ];

                if( x < uids.length - 1 ) {
                    rString += ' ';
                }
            }
        } else {
            var pCtx = appCtxSvc.ctx.occmgmtContext.productContextInfo;
            rString = pCtx && pCtx.uid;
        }
    }

    return rString;
};

/**
 * _rowSelected
 *
 * @param {Object} data data
 * @param {Object} eventData event data
 * @param {Object} selectionData selection data
 * @returns {Object} adapted requirement object from table selection
 */
export let rowSelected = function( data, eventData, selectionData ) {
    // Cancel Edits whenever Requirement changes
    editHandlerSvc.cancelEdits();

    var selection = selectionService.getSelection();
    var selectedObjs = eventData.selectedObjects;

    // Update ctx for override to disable remove command
    var reqCtx = { selection: selectedObjs };
    appCtxSvc.updateCtx( 'Ase0SystemRequirementsSelection', reqCtx );
    var objUid;
    const reqTableAdaptedSelection = [];
    const selectionToUpdate = { ...selectionData.value };

    if( selectedObjs && selectedObjs.length > 0 ) {
        if( selectedObjs[ 0 ].props.ase0RelatedElement && selectedObjs[ 0 ].props.ase0RelatedElement.dbValue ) {
            objUid = selectedObjs[ 0 ].props.ase0RelatedElement.dbValue;
        } else {
            objUid = selectedObjs[ 0 ].uid;
        }

        var adaptedObject =  cdm.getObject( objUid );
        reqTableAdaptedSelection.push( adaptedObject );
        if( objUid ) {
            // Update ctx for Attributes table
            if( _attMappingTable ) {
                var attrContext = {
                    clientName: 'AWClient',
                    clientScopeURI: 'AttributeMappingTable',

                    parentUids: objUid,
                    rootElementUids: exports.getRootElementUids(),
                    productContextUids: exports.getProductContextUids(),
                    mappingCommand: true,
                    connectionInfo: ''
                };
                appCtxSvc.updateCtx( 'Att1ShowMappedAttribute', attrContext );

                eventBus.publish( 'Att1ShowMappedAttribute.refreshTable' );
            }

            // Update selection for various commands like Info
            var contextObject = cdm.getObject( objUid );
            if( contextObject ) {
                var currentSelection = [];
                currentSelection.push( contextObject );
                selectionToUpdate.selected = currentSelection;
            } else {
                // unselect row
                data.eventData.selectedObjects[ 0 ].selected = false;

                // select parent
                selectionToUpdate.selected = [];
            }
            selectionData.update( selectionToUpdate );
        }
    } else if( _attMappingTable ) {
        if( selection.selected && selection.selected.length > 0 ) {
            objUid = selection.selected[ 0 ].uid;
        }

        // Update ctx for Attributes table
        if( objUid ) {
            var attrContext1 = {
                clientName: 'AWClient',
                clientScopeURI: 'AttributeMappingTable',

                parentUids: objUid,
                rootElementUids: exports.getRootElementUids(),
                productContextUids: exports.getProductContextUids(),

                connectionInfo: ''
            };
            appCtxSvc.updateCtx( 'Att1ShowMappedAttribute', attrContext1 );

            eventBus.publish( 'Att1ShowMappedAttribute.refreshTable' );
        }
    } else {
        selectionToUpdate.selected = [];
        selectionData.update( selectionToUpdate );
    }

    // Trigger Rich Text Viewer to Refresh
    eventBus.publish( 'requirementDocumentation.reveal' );

    data.dispatch( { path: 'data.selection', value: reqTableAdaptedSelection } );
};

/**
 * Get the applicable column configuration name based on current location
 *
 * @param {*} ctx application context
 * @param {*} data view model data
 * @param {*} subPanelContext sub panel context if any
 * @returns {String} column config name
 */
export let getColumnConfigName = function( ctx, data, subPanelContext ) {
    let columnConfigUri = 'Ase0SystemRequirementsRevisionTable';
    if( ctx.occmgmtContext ) {
        if( subPanelContext && subPanelContext.processRelation === 'CHILD' ) {
            columnConfigUri = 'Ase0SystemRequirementsTable';
        } else {
            columnConfigUri = 'Ase0SystemRequirementsRevisionTableContext';
        }
    }

    // this is required for arrange panel
    data.dataProviders.RequirementsTreeDataProvider.objectSetUri = columnConfigUri;
    return columnConfigUri;
};


/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {Object} propertyLoadInputIn - An array of PropertyLoadRequest objects this action
 *            function is invoked from. The object is usually the result of processing the 'inputData' property of a
 *            DeclAction based on data from the current DeclViewModel on the $scope) . The 'pageSize' properties on
 *            this object is used (if defined).
 *@param {String} columnConfigUri // columnConfigUri
 @return {Object} load tree table properties
 */
export let loadTreeTableProperties = function( propertyLoadInputIn, columnConfigUri ) {
    /**
     * Extract action parameters from the arguments to this function.
     * <P>
     * Note: The order or existence of parameters can varey when more-than-one property is specified in the
     * 'inputData' property of a DeclAction JSON. This code seeks out the ones this function expects.
     */
    var propertyLoadInput = '';

    for( var ndx = 0; ndx < arguments.length; ndx++ ) {
        var arg = arguments[ ndx ];

        if( awTableSvc.isPropertyLoadInput( arg ) ) {
            propertyLoadInput = arg;
        }
    }

    /**
     * Load the 'child' nodes for the 'parent' node.
     */
    return _loadTreeProperties( propertyLoadInput, columnConfigUri );
};

/**
 * loadTreeTableData
 *
 * Get a page of row data for a 'tree' table.
 *
 *  To add grouping, add something like this to Ase0SystemRequirementsViewModel.json, "loadTreeTableData"s "inputData"
 *    "groupingProperty": "REF(ase0RelatedElement,Awb0ConditionalElement).REF(awb0Archetype,ItemRevision).REF(items_tag,Item).object_type"
 * @param {Object} treeLoadInput treeLoadInput
 * @param {Object} uwDataProvider uwDataProvider
 * @param {Object} elementUids elementUids
 * @param {Object} rootElementUids rootElementUids
 * @param {Object} productContextUids productContextUids
 * @param {Object} ctx ctx
 * @param {Object} sort sort
 * @param {Object} groupingProperty groupingProperty
 * @param {Object} subPanelContext subPanelContext
 * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
 *         available.
 */
export let loadTreeTableData = function( treeLoadInput, uwDataProvider, elementUids, rootElementUids,
    productContextUids, ctx, sort, groupingProperty, subPanelContext ) {
    // Check the validity of the parameters
    var deferred = AwPromiseService.instance.defer();

    // Initialize Editing Context
    appCtxSvc.updateCtx( 'isSystemRequirementsTreeEditing', false );

    var sortCriteria = [];

    if( sort && sort.sortCriteria && sort.sortCriteria.length > 0 && sort.sortCriteria[ 0 ].fieldName.length > 0 ) {
        sortCriteria = sort.sortCriteria;
    }

    if( sortCriteria.length === 0 && sort && sort.default && sort.default.length > 0 ) {
        sortCriteria = sort.default;
    }

    var groupIds = Object.keys( _propMap );

    if( treeLoadInput.parentNode.levelNdx === -1 ) {
        _propMap = {};
        _propDisplayMap = {};

        /**
         * Get the 'child' nodes async
         */

        let relationType = 'REL_REV';
        var sysReqCtx = appCtxSvc.getCtx( 'SystemRequirements' );
        if( !sysReqCtx ) {
            sysReqCtx = {};
        }
        if( subPanelContext && subPanelContext.processRelation ) {
            relationType = subPanelContext.processRelation;
        } else if( ctx.occmgmtContext ) {
            relationType = 'TL';
        }
        appCtxSvc.updateCtx( 'SystemRequirements', sysReqCtx );
        _queryRelatedObjects( treeLoadInput.parentNode, deferred, treeLoadInput, elementUids, rootElementUids,
            productContextUids, sortCriteria, groupingProperty, relationType, 'SpecElementRevision' );
    } else if( groupIds.length > 0 && treeLoadInput.parentNode.levelNdx === 0 ) {
        var vmNodes = _propMap[ treeLoadInput.parentNode.uid.substring( 3 ) ];

        // fix the index level and expansion
        var levelNdx = treeLoadInput.parentNode.levelNdx + 1;
        _.forEach( vmNodes, function( node ) {
            node.$$treeLevel = levelNdx;
            node.levelNdx = levelNdx;
            node.isExpanded = false;
            node.children = null;
        } );

        var tempCursorObject = {
            startReached: true,
            endReached: true
        };

        // setting cursorObject fixes bug in dataProviderFactory
        treeLoadInput.parentNode.cursorObject = tempCursorObject;

        var treeLoadResult = awTableTreeSvc.buildTreeLoadResult(
            treeLoadInput, vmNodes, true, true, tempCursorObject.endReached, null );

        // If there are no nodes then prevent abort in dataProviderFactory where it looks for a cursor object
        // on the parentNode thats not there
        if( vmNodes.length === 0 ) {
            treeLoadResult.parentNode.levelNdx = 0;
        }

        deferred.resolve( {
            treeLoadResult: treeLoadResult
        } );
    } else {
        var selectedUid = null;
        var parentProxyObject = cdm.getObject( treeLoadInput.parentNode.uid );

        if( parentProxyObject && parentProxyObject.type === 'Ase0TracelinkRelationProxy' && parentProxyObject.props && parentProxyObject.props.ase0RelatedElement ) {
            selectedUid = parentProxyObject.props.ase0RelatedElement.dbValues[ 0 ];
        } else {
            var uids = utilSvc.splitRecipe( treeLoadInput.parentNode.uid );
            selectedUid = uids.relatedUid;
        }
        _queryRelatedObjects( treeLoadInput.parentNode, deferred, treeLoadInput, selectedUid, rootElementUids,
            productContextUids, sortCriteria, null, 'CHILD', '' );
    }

    deferred.promise.then( function( treeLoadResults ) {
        return treeLoadResults;
    } );

    return deferred.promise;
};

/**
 * Process column configuration as per the declarative syntax
 *
 * @param {response} response response
 * @return {Columns} column configuration
 */
export let processColumnConfigs = function( response ) {
    let columnConfigurations = _.get( response, 'columnConfigurations[0].columnConfigurations[0]' );
    if( !columnConfigurations || !columnConfigurations.columns ) {
        return columnConfigurations;
    }

    // Save Column data for later arrange
    _treeColumnInfos = [];
    let columns = columnConfigurations.columns;
    for( var idx = 0; idx < columns.length; ++idx ) {
        var columnInfo = awColumnSvc.createColumnInfo( {
            name: columns[ idx ].propertyName,
            propertyName: columns[ idx ].propertyName,
            displayName: columns[ idx ].displayName,
            typeName: columns[ idx ].associatedTypeName,
            maxWidth: 400,
            minWidth: 60,
            hiddenFlag: columns[ idx ].hiddenFlag,
            pixelWidth: columns[ idx ].pixelWidth,
            width: columns[ idx ].pixelWidth,
            enableColumnMenu: true,
            enableFiltering: false,
            enablePinning: true,
            enableSorting: true,
            enableColumnMoving: true,
            isTextWrapped: columns[idx].isTextWrapped
        } );

        _treeColumnInfos.push( columnInfo );
    }

    if( _treeColumnInfos.length > 0 ) {
        _treeColumnInfos[ 0 ].isTreeNavigation = true;
        _treeColumnInfos[ 0 ].enableColumnMoving = false;
        _treeColumnInfos[ 0 ].pinnedLeft = true;
    }
    columnConfigurations.columns = _treeColumnInfos;
    columnConfigurations.typesForArrange = [ 'Ase0TracelinkRelationProxy' ];
    return columnConfigurations;
};


/**
 * _loadTreeProperties
 *
 * @param {Object} propertyLoadInput propertyLoadInput
 * @param {Object} columnConfigUri columnConfigUri
 * @returns {Promise} promise
 */
function _loadTreeProperties( propertyLoadInput, columnConfigUri ) {
    var allChildNodes = [];

    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props ) {
                childNode.props = {};
            }

            allChildNodes.push( childNode );
        } );
    } );
    // the TreeViewModelNode with uid 'top' is a pseudo node. As a hack, send an empty result.
    if( allChildNodes.length === 1 && allChildNodes[ 0 ].uid === 'top' ) {
        var _deferred = AwPromiseService.instance.defer();
        var _propEmptyResult = {
            propertyLoadResult: {
                updatedNodes: []
            }
        };
        _deferred.resolve( _propEmptyResult );
        return _deferred.promise;
    }
    return _getPropertyModelObjects( allChildNodes, columnConfigUri );
}

/**
 * Gets the properties based on column config for the tree view model objects
 *
 * @param {Object} nodes - tree nodes to get the properties for
 * @param {Object} columnConfigUri columnConfigUri
 * @returns {Promise} promise
 */
function _getPropertyModelObjects( nodes, columnConfigUri ) {
    var _nodes = nodes;

    var propertyLoadContext = {
        clientName: 'AWClient',
        clientScopeURI: columnConfigUri,
        operationType: 'Configured'
    };
    var policy = {
        types: [ {
            name: 'Ase0TracelinkRelationProxy',
            properties: [ {
                name: 'ase0RelatedElement',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            { name: 'ase0RelationElement' },
            { name: 'ase0Direction' }
            ]
        } ]
    };

    // Add all column properties to policy
    _.forEach( _treeColumnInfos, function( columnInfo ) {
        var propertyName = columnInfo.propertyName;
        utilSvc.updatePolicy( policy, propertyName );
    } );

    var policyId = policySvc.register( policy );
    var _propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( _nodes );

    return tcVmoService.getTableViewModelProperties( _nodes, propertyLoadContext ).then(
        function( response ) { // eslint-disable-line no-unused-vars
            _.forEach( _nodes, function( node ) {
                if( node.uid === 'top' ) {
                    return;
                }
                var nodeUid = node.uid;
                var mo = response.ServiceData.modelObjects[ nodeUid ];
                var reqElementUid = mo.props.ase0RelatedElement.dbValues[ 0 ];
                var reqElement = response.ServiceData.modelObjects[ reqElementUid ];

                var _nodeIconURL = null;
                var thumbnailProp = reqElement.props.awp0ThumbnailImageTicket;
                if( thumbnailProp && thumbnailProp.dbValues && thumbnailProp.dbValues.length > 0 ) {
                    var ticket = thumbnailProp.dbValues[ 0 ];

                    if( ticket && ticket.length > 0 ) {
                        _nodeIconURL = browserUtils.getBaseURL() + 'fms/fmsdownload/' +
                            fmsUtils.getFilenameFromTicket( ticket ) + '?ticket=' + ticket;
                    }
                }

                if( reqElement.props.awb0UnderlyingObject && reqElement.props.awb0UnderlyingObject.dbValues && reqElement.props.awb0UnderlyingObject.dbValues.length > 0 ) {
                    var underlyingType = response.ServiceData.modelObjects[ reqElement.props.awb0UnderlyingObject.dbValues[ 0 ] ];

                    if( _nodeIconURL === null && underlyingType.type !== _reqElementType ) {
                        // if there are custom sub-types with custom icons, set the correct sub type icon
                        _nodeIconURL = iconSvc.getTypeIconURL( underlyingType.type );
                    }
                }

                if( _nodeIconURL === null && reqElement.type !== _reqElementType ) {
                    // if there are custom sub-types with custom icons, set the correct sub type icon
                    _nodeIconURL = iconSvc.getTypeIconURL( reqElement.type );
                }

                if( _nodeIconURL ) {
                    node.typeIconURL = _nodeIconURL;
                }
            } );
            if( policyId ) {
                policySvc.unregister( policyId );
            }
            return {
                propertyLoadResult: _propertyLoadResult
            };
        },
        function( error ) {
            return error;
        }
    );
}

/**
 * _queryRelatedObjects calls the Ase0TraceLinksStructuresProvider to get tracelinked requirements or
 * their children
 *
 * @param {ViewModelTreeNode} parentNode - A node that acts as 'parent' of a hierarchy of 'child'
 *            ViewModelTreeNodes.
 * @param {DeferredResolution} deferred - Resolved with a resulting TreeLoadResult object.
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {String} elementUids - UIDs of selected elements.
 * @param {String} rootElementUids - UIDs of root elements.
 * @param {String} productContextUids - UID of product context.
 * @param {Any} sortCriteria - sort criteria.
 * @param {Any} groupingProperty - group Property name
 * @param {String} relationType - type of relation, 'TL' or 'CHILD'.
 * @param {String} typeToFilter - typeToFilter  null or 'CHILD'.
 * @returns {Promise} //Soa response
 */
function _queryRelatedObjects( parentNode, deferred, treeLoadInput, elementUids, rootElementUids,
    productContextUids, sortCriteria, groupingProperty, relationType, typeToFilter ) {
    _attrAlignmentProxyObjects.length = 0;
    let attributesToInflate = [];
    if ( relationType !== 'REL_REV' ) {
        attributesToInflate.push( 'REF(ase0RelatedElement,Awb0ConditionalElement).awb0NumberOfChildren' );
    }
    var soaInput = {
        inflateProperties: true,
        noServiceData: true,

        searchInput: {
            maxToLoad: -1,
            maxToReturn: 0,
            attributesToInflate: attributesToInflate,

            searchCriteria: {
                dcpSortByDataProvider: 'true',
                type: typeToFilter, //'Requirement Revision',
                processRelation: relationType,
                elementUids: elementUids,
                rootElementUids: rootElementUids,
                productContextUids: productContextUids,
                processConnections: 'false',
                processTracelinks: 'true'
            },

            searchSortCriteria: sortCriteria,
            providerName: 'Ase0TraceLinksStructuresProvider'
        }
    };

    if( relationType === 'TL' ) {
        soaInput.searchInput.searchCriteria.includeOutOfContextLinks = 'true';
    }
    // check if filter map has a value
    var filter = false;
    for( var name in _searchFilterMap ) {
        filter = true;
        break;
    }

    // Add filter if its set
    if( filter && relationType === 'TL' ) {
        soaInput.searchInput.searchFilterMap6 = _searchFilterMap;
    }

    treeLoadInput.parentElement = parentNode.levelNdx === -1 ? 'AAAAAAAAAAAAAA' : parentNode.id;
    treeLoadInput.displayMode = 'Tree';

    // get the first column as per the column config
    var _columnOneProp = 'REF(ase0RelatedElement,Awb0ConditionalElement).awb0ArchetypeRevName';
    if( _treeColumnInfos && _treeColumnInfos.length > 0 ) {
        _columnOneProp = _treeColumnInfos[ 0 ].propertyName;
    }

    if( sortCriteria.length && ( !sortCriteria[ 0 ].fieldName || sortCriteria[ 0 ].fieldName === '' ) ) {
        soaInput.searchInput.searchSortCriteria[ 0 ].fieldName = _columnOneProp;
    }
    soaInput.searchInput.attributesToInflate.push( _columnOneProp );

    // add grouping property to attributesToInflate
    if( parentNode.levelNdx === -1 && groupingProperty && groupingProperty.length > 0 &&
        !_.includes( soaInput.searchInput.attributesToInflate, groupingProperty ) ) {
        soaInput.searchInput.attributesToInflate.push( groupingProperty );
    }

    return soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then(
        function( response ) {
            var searchResults = {};
            if( response.searchResultsJSON ) {
                searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
            }

            // This is the "root" node of the tree or the node that was selected for expansion
            var parentNode = treeLoadInput.parentNode;
            var levelNdx = parentNode.levelNdx + 1;
            var vmNodes = [];

            for( var childNdx = 0; searchResults.objects && childNdx < searchResults.objects.length; childNdx++ ) {
                var pobject = searchResults.objects[ childNdx ];
                var displayName = '';
                var columnOneProp = pobject.props[ _columnOneProp ];
                if( columnOneProp && columnOneProp.dbValues && columnOneProp.dbValues.length > 0 ) {
                    displayName = columnOneProp.dbValues[ 0 ];
                }

                // Note: The icon will be updated later when properties of the objects are returned
                var vmNode = awTableTreeSvc.createViewModelTreeNode( pobject.uid, _reqElementType, displayName, levelNdx, childNdx, _defaultIconURL );

                if( vmNode ) {
                    var childrenProp = pobject.props[ 'REF(ase0RelatedElement,Awb0ConditionalElement).awb0NumberOfChildren' ];
                    if( childrenProp && childrenProp.dbValues && childrenProp.dbValues.length > 0 && childrenProp.dbValues[ 0 ] !== '0' ) {
                        vmNode.isLeaf = false;
                    } else {
                        vmNode.isLeaf = true;
                    }

                    vmNodes.push( vmNode );

                    var groupProp = pobject.props[ groupingProperty ];
                    if( groupProp && groupProp.dbValues && groupProp.dbValues.length > 0 ) {
                        var groupId = groupProp.dbValues[ 0 ];

                        _propMap[ groupId ] = _propMap[ groupId ] || [];
                        _propMap[ groupId ].push( vmNode );

                        if( groupProp.uiValues && groupProp.uiValues.length > 0 ) {
                            _propDisplayMap[ groupId ] = groupProp.uiValues[ 0 ];
                        }
                    }
                }
            }

            var tempCursorObject = {
                startReached: true,
                endReached: true
            };

            // Create group branches
            var groupNodes = [];
            if( groupingProperty && relationType === 'TL' && parentNode.levelNdx === -1 ) {
                var groupIds = Object.keys( _propMap );
                for( var idx = 0; idx < groupIds.length; ++idx ) {
                    var iconURL = null;

                    // try getting icon by group prop value
                    if( !iconURL ) {
                        iconURL = iconSvc.getTypeIconURL( groupIds[ idx ] );
                    }

                    if( !iconURL ) {
                        iconURL = _defaultGroupIconURL;
                    }

                    var display = _propDisplayMap[ groupIds[ idx ] ];
                    if( !display ) {
                        display = groupIds[ idx ];
                    }

                    var groupNode = awTableTreeSvc.createViewModelTreeNode( 'id_' + groupIds[ idx ], _reqElementType, display, parentNode.levelNdx + 1, idx, iconURL );

                    groupNode.isLeaf = false;
                    groupNode.props = [ _emptyProp ];
                    groupNodes.push( groupNode );
                }

                // Getting the properties for some of the nodes now prevents the table
                // columns from loosing their display name when arranged before expanding.
                // No need to wait for the response.
                if( groupIds.length > 0 ) {
                    _getPropertyModelObjects( _propMap[ groupIds[ 0 ] ] );
                }
            }

            var populateNodes = groupNodes.length > 0 ? groupNodes : vmNodes;

            // setting cursorObject fixes bug in dataProviderFactory
            treeLoadInput.parentNode.cursorObject = tempCursorObject;

            var treeLoadResult = awTableTreeSvc.buildTreeLoadResult(
                treeLoadInput, populateNodes, true, true, tempCursorObject.endReached, null );

            // If there are no nodes then prevent abort in dataProviderFactory where it looks for a cursor object
            // on the parentNode thats not there
            if( populateNodes.length === 0 ) {
                treeLoadResult.parentNode.levelNdx = 0;
            }

            if( _fixAttMappingTableHeight ) {
                utilSvc.fixAttMapTableHeight();
            }

            deferred.resolve( {
                treeLoadResult: treeLoadResult
            } );
        },
        function( error ) {
            deferred.reject( error );
        } );
}

/**
 * Select the newly created requirements in the table
 *
 * @param {Object} eventData event for trace link creation
 * @param{Object} dataProvider data provided object
 */
export let checkNewTraceLinks = function( eventData, dataProvider ) {
    _newLink = null;
    if( eventData.relationObjects && eventData.relationObjects.length !== 1 ) {
        return;
    }
    const REV_PROP = 'props.awb0UnderlyingObject.dbValues[0]';
    let currentSelection = selectionService.getSelection();
    let currentUid = _.get( currentSelection.selected[ 0 ], REV_PROP, currentSelection.selected[ 0 ].uid );
    let startUid = _.get( eventData.startItems[ 0 ], REV_PROP, eventData.startItems[ 0 ].uid );
    let endUid = _.get( eventData.endItems[ 0 ], REV_PROP, eventData.endItems[ 0 ].uid );
    let newUid = null;
    if( startUid !== currentUid ) {
        newUid = startUid;
    } else {
        newUid = endUid;
    }
    let newLinkedObject = cdm.getObject( newUid );
    if( newLinkedObject && newLinkedObject.modelType.typeHierarchyArray.indexOf( 'SpecElementRevision' ) !== -1 ) {
        _newLink = eventData.relationObjects[ 0 ].uid;
    }
    utilSvc.reloadRequirementsTreeView( dataProvider );
};

/**
 * Select the newly created trace links in the table
 *
 * @param {*} dataProvider requirements table data provider
 * @param {*} eventData table updated event data
 * @param {*} data view model data
 */
export let selectNewTraceLinks = function( dataProvider, eventData, data ) {
    var _newPropertiesPromise = null;
    if( !_newLink ) {
        return;
    }
    let newLink = _newLink;
    _newLink = null;
    let newProxy = _.find( data.dataProviders.RequirementsTreeDataProvider.viewModelCollection.loadedVMObjects, function( vmo ) {
        return vmo && vmo.uid && vmo.uid.indexOf( newLink ) !== -1;
    } );
    if( !newProxy ) {
        dataProvider.selectionModel.selectNone();
        return;
    }
    _newPropertiesPromise = _getPropertyModelObjects( [ newProxy ],
        data.dataProviders.RequirementsTreeDataProvider.objectSetUri );
    _newPropertiesPromise.then( function() {
        dataProvider.selectionModel.setSelection( newProxy );
    } );
};

/**
 * getColumnLovs
 *
 * @param {*} data view model data
 * @return {*} lov
 */
export let getColumnLovs = function( data ) {
    var columns = [ '' ];

    // find all visible columns
    var y;
    for( y = 0; y < _treeColumnInfos.length; ++y ) {
        if( _treeColumnInfos[ y ].hiddenFlag === false ) {
            columns.push( _treeColumnInfos[ y ].name );
        }
    }

    // create list box data
    var lov = listBoxService.createListModelObjectsFromStrings( columns );

    // correct column display values
    for( var x = 1; x < lov.length; ++x ) {
        for( y = 0; y < _treeColumnInfos.length; ++y ) {
            if( lov[ x ].propInternalValue === _treeColumnInfos[ y ].name ) {
                lov[ x ].propDisplayValue = _treeColumnInfos[ y ].displayName;
                break;
            }
        }
    }

    return lov;
};

/**
 * initalizeFilterPanel
 *
 * @param {*} data view model data
 */
export let initalizeFilterPanel = function( data ) {
    // Populate Textbox and Listbox from Filter Map
    for( var name in _searchFilterMap ) {
        data.listBox.dbValue = name;

        data.textbox.dbValue = _searchFilterMap[ name ][ 0 ].stringValue;

        // Find display strings from column data
        for( var y = 0; y < _treeColumnInfos.length; ++y ) {
            if( data.listBox.dbValue === _treeColumnInfos[ y ].name ) {
                data.listBox.dispValue = _treeColumnInfos[ y ].displayName;
                data.listBox.uiValue = _treeColumnInfos[ y ].displayName;
            }
        }

        break;
    }
};

/**
 * doFilter
 *
 * @param {*} data view model data
 */
export let doFilter = function( data ) {
    var column = data.listBox.dbValue;

    var text = data.textbox.dbValue;

    var searchFilterArray = [ {
        searchFilterType: 'StringFilter',
        stringValue: text
    } ];

    // Update Filter Map
    _searchFilterMap = {};
    _searchFilterMap[ column ] = searchFilterArray;

    // Trigger table reset to apply filter
    eventBus.publish( 'primaryWorkarea.reloadTop', { retainAllStates: true } );

    // Close filter panel
    var eventData = { source: 'toolAndInfoPanel' };

    eventBus.publish( 'complete', eventData );
};

/**
 * clearFilter
 *
 * @param {*} data view model data
 */
export let clearFilter = function( data ) {
    // Update Filter Map
    _searchFilterMap = {};

    // Trigger table reset to apply filter
    eventBus.publish( 'primaryWorkarea.reloadTop', { retainAllStates: true } );

    // Close filter panel
    var eventData = {
        source: 'toolAndInfoPanel'
    };

    eventBus.publish( 'complete', eventData );
};

export let reloadReqTreeViewForSecondarySelection = function( subPanelContext, dataProvider ) {
    if( subPanelContext && dataProvider && subPanelContext.activeTab.pageId === 'tc_xrt_Interfaces' ) {
        utilSvc.reloadRequirementsTreeView( dataProvider );
    }
};

/**
 * Ase0SystemRequirementsService factory
 */

_defaultIconURL = iconSvc.getTypeIconURL( _reqElementType );
_defaultGroupIconURL = iconSvc.getTypeIconURL( 'Folder' );

_emptyProp = uwPropertyService.createViewModelProperty( 'dummy', 'dummy', 'STRING', '', [ '' ] );
_emptyProp.editable = false;
_emptyProp.isEnabled = false;

export default exports = {
    initPage,
    initializePageSplit,
    updatePanelSizes,
    getColumnConfigName,
    getElementUid,
    getCurrentProductContextUid,
    getCurrentRootElementUid,
    getRootElementUids,
    getProductContextUids,
    rowSelected,
    loadTreeTableProperties,
    loadTreeTableData,
    getColumnLovs,
    initalizeFilterPanel,
    doFilter,
    clearFilter,
    checkNewTraceLinks,
    selectNewTraceLinks,
    processColumnConfigs,
    getTopElement,
    reloadReqTreeViewForSecondarySelection
};
