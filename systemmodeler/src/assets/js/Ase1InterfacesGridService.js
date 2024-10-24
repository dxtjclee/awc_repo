//@<COPYRIGHT>@
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/
//==================================================
//Copyright 2021.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 * Interfaces grid service populates the data required to show grid
 *
 * @module js/Ase1InterfacesGridService
 */
import uwPropertySvc from 'js/uwPropertyService';
import iconSvc from 'js/iconService';
import viewModelObjectService from 'js/viewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import awColumnSvc from 'js/awColumnService';
import awIconService from 'js/awIconService';

var CELL_DISPLAY_VALUE = '9899';

/**
 * Contructs the cell data map with key as combination of column and row uid
 *
 * @param {object} connectionObjects rolled up conneciton objects in interface graph
 * @param {object} internalSystems internal systems in interface graph
 * @param {object} externalSystems external systems in interface graph
 *
 * @return {Object} cellData of a grid
 */
var getCellData = function( connectionObjects, internalSystems, externalSystems ) {
    var visibleConnMap = {};
    var cellDispMap = {};
    var cellVal = '';
    var cellData = {};
    var externSystems = [];
    if( connectionObjects ) {
        externSystems = _.filter( externalSystems, function( extrenSys ) {
            return extrenSys.name !== 'object_name';
        } );
        _.forEach( connectionObjects, function( connectionObj ) {
            var mapKey = '';
            var connObjects = [];
            mapKey = connectionObj.srcUid;
            mapKey = mapKey.concat( '+' ).concat( connectionObj.tarUid );
            connObjects = visibleConnMap[ mapKey ];
            if( !connObjects ) {
                connObjects = [];
            }
            connObjects.push( connectionObj.connModelObj );
            visibleConnMap[ mapKey ] = connObjects;
        } );
    }
    cellData.cellUids = visibleConnMap;
    _.forEach( internalSystems, function( internalSystem ) {
        _.forEach( externSystems, function( externalSystem ) {
            var key = internalSystem.uid.concat( '+' ).concat( externalSystem.name );
            var relations = visibleConnMap[ key ];
            if( relations ) {
                cellVal = getCellValue( relations );
            } else {
                cellVal = '';
            }
            cellDispMap[ key ] = cellVal;
        } );
    } );
    cellData.cellDispVals = cellDispMap;
    return cellData;
};

/**
 * return the dispay value of the cell
 *
 * @param {object} relations connection object
 *
 * @return {String} cell display value
 */
var getCellValue = function( relations ) {
    if( relations && relations.length > 0 ) {
        return '&#' + CELL_DISPLAY_VALUE + ';';
    }
};

/**
 * Return the external nodes for selected object
 * @param {Object} modelData model data
 * @param {Object} selectedLabelProperty selected Label data
 * @return {Array} externalNodes of selected object
 */
var getExternalNodes = function( modelData, selectedLabelProperty ) {
    var interfacesCtx = modelData;
    var externalNodes = [];
    var displayProp = getDisplayProperty( selectedLabelProperty );
    if( interfacesCtx && interfacesCtx.nodeMap && interfacesCtx.externalSystems &&
        interfacesCtx.externalSystems.length > 0 ) {
        _.forEach( interfacesCtx.externalSystems, function( node ) {
            if( interfacesCtx.nodeMap[ node.nodeObject.uid ] ) {
                var nodeObject = interfacesCtx.nodeMap[ node.nodeObject.uid ].nodeObject;
                if( nodeObject && nodeObject.props && nodeObject.props[ displayProp ] ) {
                    externalNodes.push( interfacesCtx.nodeMap[ node.nodeObject.uid ].nodeObject );
                } else {
                    var uiValues = [ node.nodeLabel ];
                    nodeObject.props[ displayProp ] = {};
                    nodeObject.props[ displayProp ].uiValues = uiValues;
                    externalNodes.push( nodeObject );
                }
            }
        } );
    }
    return externalNodes;
};

/**
 * Return the internal systems for selected object with the system of interest as first object
 * @param {Object} modelData model data
 * @return {Array} internalNodes for selected object
 */
var getInternalNodes = function( modelData ) {
    var interfacesCtx = modelData;
    var internalNodes = [];

    if( interfacesCtx && interfacesCtx.nodeMap && interfacesCtx.internalSystems && interfacesCtx.internalSystems.length > 0 ) {
        _.forEach( interfacesCtx.internalSystems, function( node ) {
            if( interfacesCtx.nodeMap[ node.nodeObject.uid ] ) {
                interfacesCtx.nodeMap[ node.nodeObject.uid ].nodeObject.nodeLabel = node.nodeLabel;
                interfacesCtx.nodeMap[ node.nodeObject.uid ].nodeObject.numChildren = node.numChildren;
                internalNodes.push( interfacesCtx.nodeMap[ node.nodeObject.uid ].nodeObject );
            }
        } );
    } else {
        if( interfacesCtx && interfacesCtx.systemOfInterest ) {
            interfacesCtx.systemOfInterest.nodeObject.nodeLabel = interfacesCtx.systemOfInterest.nodeLabel;
            interfacesCtx.systemOfInterest.nodeObject.numChildren = interfacesCtx.systemOfInterest.numChildren;
            internalNodes.push( interfacesCtx.systemOfInterest.nodeObject );
        }
    }
    return internalNodes;
};

/**
 * get the current system of interest and system in view
 * @param {Object} modelData model data
 * @param {Object} selectedLabelProperty selected Label data
 * @return {Array} pinnedColumns
 */
const getPinnedColumn = function( modelData, selectedLabelProperty ) {
    var interfacesCtx = modelData;
    var pinnedColumns = [];

    if( interfacesCtx && interfacesCtx.nodeMap && interfacesCtx.systemOfInterest && interfacesCtx.systemInView ) {
        if( interfacesCtx.systemOfInterest.nodeObject.uid === interfacesCtx.systemInView.nodeObject.uid ) {
            var updateSystemOfInterest = updateNodeObjectDisplayProp( interfacesCtx.systemOfInterest, selectedLabelProperty );
            pinnedColumns.push( updateSystemOfInterest.nodeObject );
        } else {
            var systemInView = updateNodeObjectDisplayProp( interfacesCtx.systemInView, selectedLabelProperty );
            var systemOfInterest = updateNodeObjectDisplayProp( interfacesCtx.systemOfInterest, selectedLabelProperty );
            pinnedColumns.push( systemOfInterest.nodeObject );
            pinnedColumns.push( systemInView.nodeObject );
        }
    }
    return pinnedColumns;
};

/**
 * Update display properties of Node object
 *
 * @param {object} system in graph
 * @param {Object} selectedLabelProperty selected Label data
 * @return {Object} system with updated properties
 */
var updateNodeObjectDisplayProp = function( system, selectedLabelProperty ) {
    var displayProp = getDisplayProperty( selectedLabelProperty );
    if( system.nodeObject && system.nodeObject.props && !system.nodeObject.props[ displayProp ] ) {
        var uiValues = [ system.nodeLabel ];
        system.nodeObject.props[ displayProp ] = {};
        system.nodeObject.props[ displayProp ].uiValues = uiValues;
    }
    return system;
};

/**
 * Returns the rolled up connection on the interfaces graph
 * @param {Object} modelData model data
 * @return {Array} edges
 */
var getConnectionObjects = function( modelData ) {
    var interfacesCtx = modelData;
    var edges = [];
    if( interfacesCtx && interfacesCtx.edges && interfacesCtx.edges.length > 0 ) {
        _.forEach( interfacesCtx.edges, function( edge ) {
            var connectionObj = edge.edgeObject;
            var srcNode = edge.end1Element;
            var tarNode = edge.end2Element;
            var connection = {
                connModelObj: connectionObj,
                srcUid: srcNode.uid,
                tarUid: tarNode.uid
            };
            edges.push( connection );
        } );
    }
    return edges;
};

/**
 * get the current display property from context
 * @param {Object} selectedLabelProperty selected Label data
 * @return {String} display property
 */
var getDisplayProperty = function( selectedLabelProperty ) {
    var displayProp = 'object_string';
    if( selectedLabelProperty ) {
        var propName = selectedLabelProperty.name.split( '.' );
        displayProp = propName[ 1 ];
    }
    return displayProp;
};

const loadCols = function( columnObjects, pinnedColsInfo, displayProperty ) {
    let columnDefns = [];
    let propName;
    let firstColumnInfo = awColumnSvc.createColumnInfo();

    /**
     * Set values for common properties
     */
    firstColumnInfo.name = 'object_name';
    firstColumnInfo.enableColumnResizing = true;
    firstColumnInfo.enableColumnMenu = true;
    firstColumnInfo.width = 190;
    firstColumnInfo.minWidth = 100;

    /**
     * Set values for un-common properties
     */
    firstColumnInfo.typeName = 'String';
    firstColumnInfo.enablePinning = true;
    firstColumnInfo.enableSorting = false;
    firstColumnInfo.pinnedLeft = true;
    firstColumnInfo.enableColumnHiding = false;
    firstColumnInfo.displayProperty = displayProperty;
    if( pinnedColsInfo && pinnedColsInfo.length > 0 ) {
        firstColumnInfo.pinnedColumVMO = pinnedColsInfo;
    }
    firstColumnInfo.displayName = firstColumnInfo.pinnedColumVMO && firstColumnInfo.pinnedColumVMO[0].cellHeader1;
    columnDefns.push( firstColumnInfo );
    for( let colNdx = 0; colNdx < columnObjects.length; colNdx++ ) {
        /**
         * @property {Number|String} width - Number of pixels
         * @memberOf module:js/awColumnService~AwTableColumnInfo
         */
        if( columnObjects[ colNdx ] !== null ) {
            propName = columnObjects[ colNdx ].uid;
            let propDisplayName = '';
            if( displayProperty ) {
                propDisplayName = columnObjects[ colNdx ].props[ displayProperty ].uiValues[ 0 ];
            } else {
                propDisplayName = columnObjects[ colNdx ].props.object_string.uiValues[ 0 ];
            }
            let columnInfo = awColumnSvc.createColumnInfo();
            columnInfo.vmo = columnObjects[ colNdx ];

            /**
             * Set values for common properties
             */
            columnInfo.name = propName;
            columnInfo.displayName = propDisplayName;
            columnInfo.enableColumnResizing = true;
            columnInfo.width = 48;
            columnInfo.minWidth = 48;
            columnInfo.displayProperty = displayProperty;

            /**
             * Set values for un-common properties
             */
            columnInfo.typeName = 'String';
            columnInfo.enableColumnMenu = true;
            columnInfo.enableColumnHiding = false;
            columnInfo.enableSorting = false;
            columnInfo.pinnedLeft = false;
            columnInfo.typeIconURL = awIconService.getTypeIconFileUrl( columnObjects[ colNdx ] );
            columnInfo.cellRenderers = [ interfacesGridCellRendererFn() ];
            columnDefns.push( columnInfo );
        }
    }
    return columnDefns;
};

/**
 * updates column information on the dataprovider
 *
 * @param {Object} modelData model data
 * @param {Object} selectedLabelProperty selected Label data
 * @return {Object} column info
 */
export let getColumnInfos = function( modelData, selectedLabelProperty ) {
    if( modelData && selectedLabelProperty ) {
        var externalSystems = getExternalNodes( modelData, selectedLabelProperty );
        var pinedColInfos = getPinnedColumn( modelData, selectedLabelProperty );
        var displayProp = getDisplayProperty( selectedLabelProperty );
        var columnDefns = loadCols( externalSystems, pinedColInfos, displayProp );
        return {
            columnInfos: columnDefns
        };
    }
};

/**
 * Construct rows for declarative matrix.
 *
 * @param {Object} rowObjects - List of row objects this function will use for constructing the data
 * @param {Object} cellData - Comprising of cell contents to be shown in the matrix cell
 * @param {Object} uwDataProvider instance of the dataprovider for the grid
 * @param {Object} selectedLabelProperty selected Label data
 * @return {Object} search result for matrix rows
 */
var loadData = function( rowObjects, cellData, uwDataProvider, selectedLabelProperty ) {
    var rows = rowObjects;
    var columnDef = uwDataProvider.columnInfos;

    var vmRows = [];
    var displayProperty = getDisplayProperty( selectedLabelProperty );
    var cellDispVals = null;
    var cellUids = null;
    if( cellData ) {
        cellDispVals = cellData.cellDispVals;
        cellUids = cellData.cellUids;
    }

    for( var rowNdx = 0; rowNdx < rows.length; rowNdx++ ) {
        var displayLabel = rows[ rowNdx ].nodeLabel;
        let numChildren = rows[ rowNdx ].numChildren;
        var newVMO = viewModelObjectService.createViewModelObject( rows[ rowNdx ].uid );

        if( newVMO !== null && columnDef ) {
            for( var iDx = 0; iDx < columnDef.length; iDx++ ) {
                if( columnDef[ iDx ].name === 'object_name' ) {
                    var dbValues = 'object_name';

                    var dbvalueArr = [];
                    dbvalueArr.push( dbValues );

                    var displayValues = '';

                    //check if the object display property is loaded or create the display property
                    if( displayProperty && newVMO.props[ displayProperty ] && newVMO.props[ displayProperty ].uiValues ) {
                        displayValues = newVMO.props[ displayProperty ].uiValues[ 0 ];
                    } else {
                        if( displayProperty && newVMO.props ) {
                            displayValues = displayLabel;
                            var displayLabelArr = [ displayLabel ];
                            newVMO.cellHeader1 = displayValues;
                            var displayProp = uwPropertySvc.createViewModelProperty( displayProperty, displayProperty,
                                'String', displayLabel, displayLabelArr );
                            newVMO.props[ displayProperty ] = displayProp;
                        }
                    }

                    var displayValuesArr = [];

                    displayValuesArr.push( displayValues );

                    var prop = uwPropertySvc.createViewModelProperty( columnDef[ iDx ].name,
                        columnDef[ iDx ].displayName, 'String', dbvalueArr, displayValuesArr );

                    prop.propertyDescriptor = {
                        displayName: columnDef[ iDx ].displayName,
                        colId: columnDef[ iDx ].name,
                        rowId: rows[ rowNdx ].uid,
                        rowIdx: rowNdx
                    };

                    prop.typeIconURL = iconSvc.getTypeIconURL( newVMO.type );
                    newVMO.props[ columnDef[ iDx ].name ] = prop;
                    newVMO.isRowSelected = false;
                    newVMO.displayProperty = displayProperty;
                    newVMO.numChildren = numChildren;
                } else {
                    var colKey = columnDef[ iDx ].name;
                    var rowKey = rows[ rowNdx ].uid;

                    dbvalueArr = [];
                    displayValuesArr = [];

                    var mapKey = rowKey + '+' + colKey;
                    if( cellUids && cellUids[ mapKey ] ) {
                        var connObj = cellUids[ mapKey ][ 0 ];
                        if( connObj ) {
                            dbvalueArr.push( connObj.uid );
                        }
                    }
                    if( cellDispVals !== null ) {
                        displayValuesArr.push( cellDispVals[ mapKey ] );
                    }
                    prop = uwPropertySvc.createViewModelProperty( columnDef[ iDx ].name,
                        columnDef[ iDx ].displayName, 'String', dbvalueArr, displayValuesArr );

                    prop.propertyDescriptor = {
                        displayName: columnDef[ iDx ].displayName,
                        colId: columnDef[ iDx ].name,
                        rowId: rows[ rowNdx ].uid,
                        rowIdx: rowNdx
                    };

                    newVMO.props[ columnDef[ iDx ].name ] = prop;
                    newVMO.isRowSelected = false;
                    newVMO.displayProperty = displayProperty;
                }
            }
            vmRows.push( newVMO );
        }
    }
    return {
        searchResults: vmRows,
        totalFound: vmRows.length
    };
};

/**
 * Load the Interfaces grid with the data
 *
 * @param {Object} data declarative view model
 * @param {Object} modelData model data
 * @param {Object} selectedLabelProperty selected Label data
 * @param {Object} interfaceCellDisplayValue interface Cell Display Valuedata
 * @return {Object} Object containing matrix data
 */
export let loadDataForInterfacesGrid = function( data, modelData, selectedLabelProperty, interfaceCellDisplayValue ) {
    let uwDataProvider = data.dataProviders.interfacesGridDataProvider;
    CELL_DISPLAY_VALUE = interfaceCellDisplayValue;
    let internalSystems = getInternalNodes( modelData );
    let externalSystems = uwDataProvider.columnInfos;
    let connectionObjects = getConnectionObjects( modelData );
    let cellData = getCellData( connectionObjects, internalSystems, externalSystems );
    return loadData( internalSystems, cellData, uwDataProvider, selectedLabelProperty );
};

/**
 * Custom renderer for matrix tree non-command column cells
 * @returns {HTMLElement} Matrix Tree Cell element
 */
const interfacesGridCellRendererFn = function() {
    return {
        action: function( column, vmo ) {
            let colData = vmo.props[ column.field ];
            let containerElem = document.createElement( 'div' );
            containerElem.className = 'aw-splm-tableCellTop';
            let spanElement = document.createElement( 'span' );
            if( colData && column.field !== 'object_name' ) {
                spanElement.innerHTML = colData.uiValue;
                containerElem.title = vmo.cellHeader1 + '\n' + colData.propertyDisplayName;
                containerElem.onclick = function( event ) {
                    event.preventDefault();
                    event.stopPropagation();
                    var selectedCellObjects = [];
                    var edgeUids = vmo.props[ column.field ].dbValue;
                    if( edgeUids && edgeUids.length ) {
                        _.forEach( edgeUids, function( edgeId ) {
                            var edgeObj = cdm.getObject( edgeId );
                            if( edgeObj ) {
                                selectedCellObjects.push( edgeObj );
                            }
                        } );
                    }
                    var selectionData = {
                        selection: selectedCellObjects
                    };
                    eventBus.publish( 'interfacesGridDataProvider.gridCellSelection', selectionData );
                };
            }
            containerElem.appendChild( spanElement );
            return containerElem;
        },
        condition: function( column ) {
            return true;
        }
    };
};

export let setInterfacesCellSelection = function( eventData, selectionData ) {
    selectionData.update( {
        selected: eventData
    } );
};

/**
 * Navigates to internal system and update the grid
 *
 * @param {object} doubleClickedObject object double clicked on grid
 * @param {Object} pageState page state
 */
export let interfacesGridNavigateSystem = function( doubleClickedObject, pageState ) {
    const pageStateValue = { ...pageState.value };
    pageStateValue.doubleClickedObject = doubleClickedObject;
    pageState.update( pageStateValue );
};

const exports = {
    getColumnInfos,
    loadDataForInterfacesGrid,
    interfacesGridNavigateSystem,
    setInterfacesCellSelection
};

export default exports;
