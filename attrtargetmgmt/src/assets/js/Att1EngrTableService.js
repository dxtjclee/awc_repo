/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 * @module js/Att1EngrTableService
 */
import { getBaseUrlPath } from 'app';
import clipboardService from 'js/clipboardService';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import popupService from 'js/popupService';
import tcViewModelObjectSvc from 'js/tcViewModelObjectService';
import complexDataService from 'js/Att1ComplexDataService';
import parameterMgmtUtil from 'js/Att1ParameterMgmtUtilService';
import msgSvc from 'js/messagingService';
import $ from 'jquery';
import leavePlaceService from 'js/leavePlace.service';
import notyService from 'js/NotyModule';
import localeService from 'js/localeService';
import AwPromiseService from 'js/awPromiseService';
import att1ChartService from 'js/Att1ChartService';
import Att1ChartService from './Att1ChartService';
import cdm from 'soa/kernel/clientDataModel';
//
// d3 this needs to remain here.
//
var d3 = require( 'd3' );
const cell_height = 30;
const cell_width = 82;
const min_cell_width = 1;
var exports = {};
var matrix = [];
var network_data;

var _loadingTooltip = false;
var _popupRefEditGmm;
var _popupRefUom;
var _popupRefCtx;
var leaveHandler = {};
var singleLeaveConfirmation = '';
var saveTxt = '';
var discardTxt = '';
var _showId;
var uomIndex;
var listValues = [];
var timeout;
var undoStack = [];
const noEmptyCells = !appCtxSvc.ctx.tcSessionData || appCtxSvc.ctx.tcSessionData.tcMajorVersion < 14 ||
    appCtxSvc.ctx.tcSessionData.tcMajorVersion === 14 && appCtxSvc.ctx.tcSessionData.tcMinorVersion === 0;

var m_selectedParameter;

var isDoubleClick = false;
/**
 * Add a new complex table to a  parameter
 * @param {*} data Table data
 * @param {*} subPanelContext subpanelContext
 */
export let addNewComplexTable = function( data, openedObject ) {
    var copyData = {
        selectedParameter : openedObject
    };
    var tableData = createGrid( data.columns.dbValue, data.rows.dbValue, copyData );
    //     refreshMatrix( tableData );
    eventBus.publish( 'setAttributeComplexDataSoaCallOverride' );
};

/**
 * Create d3 table grid
 * @param data Data model
 */
export let createGrid = function( columns, rows, copyData ) {
    var matrixData = {};
    var rowNodes = [];
    var units = [];
    var colNodes = [ { text: '' } ];
    var noOfColumns = columns;
    var noOfRows = rows;

    for( var i = 0; i < noOfRows; i++ ) {
        rowNodes[ i ] = { text: '', displayText: '' };
    }
    for( i = 1; i <= noOfColumns; i++ ) {
        colNodes[ i ] = { text: '', units: '', displayText: '', width: cell_width };
    }

    var emptyCell = {};
    if ( noEmptyCells ) {
        emptyCell = { Goal: '', Min: '', Max: '' };
    }
    var goalValue = '';
    var minValue = '';
    var maxValue = '';
    if ( copyData && copyData.selectedParameter && copyData.selectedParameter.props &&
        ( copyData.selectedParameter.props.att0AttributeTable.dbValues[0] === '' || copyData.selectedParameter.props.att0AttributeTable.dbValues[0] === null || copyData.selectedParameter.props.att0AttributeTable.dbValues[0] === undefined ) ) {
        goalValue = copyData.selectedParameter.props.att0Goal.uiValues[0];
        if( copyData.selectedParameter.props.att0Min !== undefined ) {
            minValue = copyData.selectedParameter.props.att0Min.uiValues[0];
        }
        if( copyData.selectedParameter.props.att0Max !== undefined ) {
            maxValue = copyData.selectedParameter.props.att0Max.uiValues[0];
        }
    }
    var cells = [];

    for( var j = 0; j < noOfRows; j++ ) {
        cells[ j ] = [];
        for( i = 0; i < noOfColumns; i++ ) {
            cells[ j ][ i ] = _.clone( emptyCell );
            if( j === 0 ) {
                cells[j][i].Goal = goalValue;
                cells[j][i].Min = minValue;
                cells[j][i].Max = maxValue;
            }
        }
    }

    var table = {};
    table.rowHeaders = rowNodes;
    table.columnHeaders = colNodes;
    table.tableName = 'goalTable';
    table.rows = cells;
    var tableData = {};
    tableData.rowHeaders = rowNodes;
    tableData.columnHeaders = colNodes;
    var subHeaders = [ 'goal', 'min', 'max' ];
    tableData.showSubHeaders = true;
    tableData.subHeaders = subHeaders;
    tableData.table = table;
    tableData.cells = cells;
    tableData.units = units;
    tableData.numValues = 1;
    matrixData.tableData = tableData;
    network_data = tableData;
    return matrixData;
};

/**
 * Get cell object in storable form. Blank values are not included to reduce json string size.
 * @param {*} cell cell info
 * @returns {*} Cell
 */
function getCellInfo( cell ) {
    var data = {};
    if ( noEmptyCells ) {
        data.Goal = cell.Goal;
        data.Min = cell.Min;
        data.Max = cell.Max;
    } else {
        if ( cell.Goal && cell.Goal !== '' ) {
            data.Goal = cell.Goal;
        }
        if ( cell.Min && cell.Min !== '' ) {
            data.Min = cell.Min;
        }
        if ( cell.Max && cell.Max !== '' ) {
            data.Max = cell.Max;
        }
    }
    return data;
}

/**
 * Create a json string for the d3 table object
 * @param {boolean} isValueTable If true get json for value table, if false goal
 * @return {*} att0GoalTable for SOA input
 */
export let createJson = function( isValueTable ) {
    var myJson = {};
    var cellInfo = [];
    isValueTable = network_data.tableName === 'valueTable';

    // get cell info
    for( var i = 0; i < network_data.cells.length; i++ ) {
        var row = network_data.cells[ i ];
        var cellInfoArray = [];
        for( var j = 0; j < row.length; j++ ) {
            if( isValueTable ) {
                cellInfoArray[j] = {};
                if ( row[j].Measurement && row[j].Measurement !== '' || noEmptyCells ) {
                    cellInfoArray[j].Value = row[j].Measurement;
                }
            } else {
                cellInfoArray[ j ] = getCellInfo( row[j] );
            }
        }

        cellInfo[ i ] = cellInfoArray;
    }

    myJson.rowHeaders = [];
    myJson.units = network_data.units;
    myJson.columnHeaders = [];
    //TODO - setting it blank for now
    myJson.tableRowTitle = '';
    myJson.tableColumnTitle = '';

    if( network_data.hasRowHeaders ) {
        for( i = 0; i < network_data.rowHeaders.length; i++ ) {
            myJson.rowHeaders[ i ] = { title: network_data.rowHeaders[ i ].text };
        }
    }

    // rebuild column headers with series TODO this can be done better
    var currentSeries = -1;
    var idx = 0;
    for( i = network_data.hasRowHeaders ? 0 : 1; i < network_data.columnHeaders.length; i++ ) {
        var colHeader = {
            title: network_data.columnHeaders[ i ].text,
            units: network_data.columnHeaders[ i ].units,
            width: network_data.columnHeaders[ i ].width
        };
        if( network_data.hasColumnSeries && i === 0 ) {
            myJson.columnHeaders[ 0 ] = {
                title: '',
                units: '',
                children: [ colHeader ]
            };
            idx++;
        } else if( network_data.columnHeaders[ i ].series > -1 ) {
            if( network_data.columnHeaders[ i ].series !== currentSeries ) {
                currentSeries = network_data.columnHeaders[ i ].series;
                myJson.columnHeaders[ idx ] = {
                    title: network_data.columnSeries[ currentSeries ].text,
                    units: network_data.columnSeries[ currentSeries ].units,
                    children: [ colHeader ]
                };
                idx++;
            } else {
                myJson.columnHeaders[ idx - 1 ].children.push( colHeader );
            }
        } else {
            myJson.columnHeaders[ idx ] = colHeader;
            idx++;
        }
    }
    myJson.cellInfo = cellInfo;
    return JSON.stringify( myJson );
};

/**
 * Gets instance of selected parameter object
 * @return {*} selected parameter instance
 */
export let getSelectedMeasurement = function() {
    return complexDataService.getSelectedMeasurement();
};

/**
 * @return {*} Selected measurement
 * Process the Partial error being thrown from the updateParameters2 SOA
 * @param {object} response - the response Object of SOA
 * @return {String} message - Error message to be displayed to user
 */
export let processPartialErrorForComplexData = function( response ) {
    var msgObj = {
        msg: '',
        level: 0
    };
    if( response && response.partialErrors ) {
        _.forEach( response.partialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
    }

    return msgObj.msg;
};

/**
 * Gets message string
 * @param {*} messages Messages to display
 * @param {*} msgObj msgObj
 */
var getMessageString = function( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        msgObj.msg += '<BR/>';
        msgObj.msg += object.message;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
};

/**
 * Set table container size.
 * @param {*} tableData the table data
 */
export let set_visualization_size = function( tableData ) {
    var size = getViewerHeight();

    d3.select( '#' + network_data.tableName )
        .style( 'height', size.height + 'px' )
        .style( 'overflow', 'auto' );
    var mainDiv = document.getElementById( network_data.tableName );

    mainDiv.addEventListener( 'scroll', adjustTable );
    window.addEventListener( 'resize', adjustTable );
    return size;
};

/**
 * Handle modifification of table window size of scroll position.
 */
function adjustTable() {
    if( timeout ) {
        clearTimeout( timeout );
    }
    timeout = setTimeout( () => {
        var size = getViewerHeight();
        d3.select( '#' + network_data.tableName )
            .style( 'height', size.height + 'px' );
        var element = document.getElementById( network_data.tableName );
        if ( element ) {
            network_data.scroll2 = { top: element.scrollTop, left: element.scrollLeft };
        }
        eventBus.publish( 'engrTable.renderTable', size );
    }, 50 );
}

export let removeListeners = function() {
    window.removeEventListener( 'resize', adjustTable );
};

/**
 * Redraw the tables data area.
 * @param {*} data Table data
 * @param {*} eventData Table size
 */
export let redrawTable = function( data, eventData ) {
    renderDataArea( network_data, eventData, data );
    eventBus.publish( 'Att1EngrTable.ScrollCompleted' );
};

/**
 * Render data cells in the visible part of the table.
 * @param {*} tableData Table data
 */
function renderDataArea( tableData, size, engrTable ) {
    var element = document.getElementById( tableData.tableName );
    if ( !element ) {
        return;
    }
    var ht = element.clientHeight;
    var width = element.clientWidth;
    if ( size ) {
        ht = size.height;
        width = size.width;
    }
    if ( tableData.scroll ) {
        element.scroll( tableData.scroll.left,  tableData.scroll.top );
        tableData.scroll = null;
    }
    if ( network_data.scroll2 ) {
        element.scroll( network_data.scroll2.left,  network_data.scroll2.top );
        network_data.scroll = null;
    }
    var scroll = element.scrollTop;
    var scrollLeft = element.scrollLeft;
    var noOfRows = Math.max( Math.floor( scroll / cell_height ) - 1, tableData.headerRowCount );
    var noOfCols = 0;
    var endCol = tableData.columnStart.length;
    var start = tableData.headerColCount + 1;
    for ( var i = start; i < tableData.columnStart.length; i++ ) {
        if ( tableData.columnStart[i] > scrollLeft ) {
            noOfCols = i === start ? 0 : i - start - 1;
            break;
        }
    }
    for ( i = noOfCols; i < tableData.columnStart.length; i++ ) {
        if ( tableData.columnStart[i] > scrollLeft + width ) {
            endCol = i + 1;
            break;
        }
    }
    var endRow = noOfRows + Math.ceil( ht / cell_height ) + 2;
    var dataToLoad = matrix.slice( noOfRows, endRow );
    var finalDataToLoad = [];
    for( var k = 0; k < dataToLoad.length; k++ ) {
        finalDataToLoad[k] = [];

        var row = dataToLoad[ k ];
        finalDataToLoad[k] = row.slice( noOfCols, endCol );
    }
    var matrix_cluster = d3.select( '.data-area' );
    matrix_cluster.selectAll( '*' ).remove();
    matrix_cluster
        .selectAll( '.row' )
        .data( finalDataToLoad )
        .enter()
        .append( 'g' )
        .attr( 'class', 'row_lines' )
        .attr( 'transform', function( d ) {
            return 'translate (  0,' + d[ 0 ].pos_y * cell_height + ')';
        } )
        .each( function( d ) {
            row_function( d, this, tableData );
        } );

    addCellBehavior( tableData );
    if ( network_data.editMode ) {
        startEditInEngrTable( engrTable );
    }
    setSelections( getSelections( engrTable ) );
    // reapply copied cell highlight
    var copiedCells = _.get( appCtxSvc, 'ctx.' + network_data.tableName + '.copiedCells', [] );
    copiedCells.forEach( cellData => {
        if ( cellData.pos_x >= noOfCols && cellData.pos_x <= endCol && cellData.pos_y >= noOfRows && cellData.pos_y <= endRow ) {
            var cell = getCell( cellData.pos_y, cellData.pos_x );
            if ( !cell.empty() ) {
                cell.classed( 'copying', true );
            }
        }
    } );
    matrix_cluster.node().focus();
    if ( tableData.focus ) {
        focusCell( tableData.focus.row, tableData.focus.col );
        tableData.focus = null;
    }
}

/**
 * Method to calculate the viewer height
 * @returns {Integer} the height to be set
 */
export let getViewerHeight = function() {
    var height = 637;
    var width = 600;
    var widePanelForm = document.querySelector( 'div.aw-attrtargetmgmt-widePanel' );
    if( widePanelForm ) {
        width = widePanelForm.clientWidth;
        height = doWidePanelCalculation( widePanelForm );
    } else {
        var xrtObjectPage = document.querySelector( 'div.aw-layout-defaultSublocation' );
        if( !xrtObjectPage ) {
            xrtObjectPage = document.querySelector( 'div.aw-layout-sublocationContent' );
        }
        width = xrtObjectPage.clientWidth;
        height = doParametersLocationCalculation( xrtObjectPage );
    }
    return { width: width, height: height };
};

/**
 * Method to calculate the visible height of the viewer for comple table when parameter opened in wide panel
 * @param {Element} widePanelForm the element representing wide panel viewer element
 * @returns {Interger} the height to be set
 */
function doWidePanelCalculation( widePanelForm ) {
    var height = 460;
    var parent = widePanelForm;
    while( !parent.classList.contains( 'sw-popup-contentContainer' ) ) {
        parent = parent.parentElement;
        if( !parent ) {
            break;
        }
    }
    if( parent ) {
        height = parent.clientHeight;
        //remove the header height
        var headerEle = parent.querySelectorAll( 'div.aw-layout-panelTitle' );
        if( headerEle && headerEle.length > 0 ) {
            height -= headerEle[ 0 ].clientHeight * headerEle.length;
        }
        //remove the tab container height
        var tabContainer = widePanelForm.querySelectorAll( 'ul.sw-tabContainer' );
        if( tabContainer && tabContainer.length > 0 ) {
            height -= tabContainer[ 0 ].clientHeight * tabContainer.length + 8; // 8 is padding of tabset;
        }
        // remove the toolbar height
        var commandBarEle = widePanelForm.querySelectorAll( 'div.aw-attrtargetmgmt-toolbar' );
        if( commandBarEle && commandBarEle.length > 0 ) {
            height -= commandBarEle[ 0 ].clientHeight * commandBarEle.length;
            //remove padding after tab container
            height -= 32;
        }

        // remove the toolbar height
        var splmTables = widePanelForm.querySelectorAll( 'aw-splm-table' );
        if( splmTables && splmTables.length > 0 ) {
            height -= splmTables[ 0 ].clientHeight * splmTables.length;
            //additional for measurements tab
            height -= 40;
        }

        // remove the toolbar height
        var panelSectionTitle = widePanelForm.querySelectorAll( 'div.aw-attrtargetmgmt-measurementsHeader' );
        if( panelSectionTitle && panelSectionTitle.length > 0 ) {
            height -= panelSectionTitle[ 0 ].clientHeight * panelSectionTitle.length;
        }
        //removing padding height
        height -= 33;
    }
    return height;
}

/**
 * Method to calculate the visible height of the viewer for comple table when parameter opened in own location
 * @param {Element} xrtObjectPage the element representing secondary viewer element
 * @returns {Interger} the height to be set
 */
function doParametersLocationCalculation( xrtObjectPage ) {
    var height = xrtObjectPage.clientHeight;
    // remove the toolbar height
    var commandBarEle = xrtObjectPage.querySelectorAll( 'div.aw-attrtargetmgmt-toolbar' );
    if( commandBarEle && commandBarEle.length > 0 ) {
        height -= commandBarEle[ 0 ].clientHeight * commandBarEle.length;
    }

    //additional for measurements tab
    var splmTables = xrtObjectPage.querySelectorAll( 'aw-splm-table' );
    if( splmTables && splmTables.length > 0 ) {
        height -= 40;
        height -= splmTables[ 0 ].clientHeight * splmTables.length;
    }
    var panelSectionTitle = xrtObjectPage.querySelectorAll( 'div.aw-attrtargetmgmt-measurementsHeader' );
    if( panelSectionTitle && panelSectionTitle.length > 0 ) {
        height -= panelSectionTitle[ 0 ].clientHeight * panelSectionTitle.length + 30;
    }

    //remove the tab container height
    var tabContainer = xrtObjectPage.querySelectorAll( 'ul.sw-tabContainer' );
    if( tabContainer && tabContainer.length > 0 ) {
        height -= tabContainer[ 0 ].clientHeight * tabContainer.length;
    }

    //removing padding
    height -= 80;
    return height;
}

/**
 * Render the give engineering table data.
 * @param {Object} eventData Table data to display
 * @param {*} data Table data object with localized names
 */
export let refreshMatrix = function( eventData, data ) {
    if( eventData && eventData.tableData ) {
        const matrixContainer = document.getElementById( eventData.tableName );
        if( matrixContainer ) {
            d3.select( '#main_svg' ).remove();
            d3.select( '#' + eventData.tableData.tableName )
                .append( 'svg' )
                .attr( 'id', 'main_svg' )
                .attr( 'class', 'aw-engrtable-mainSvg' )
                .attr( 'overflow', 'auto' );
            setColumnWidths( eventData.tableData.columnHeaders );
            network_data = eventData.tableData;
            network_data.readOnly = eventData.readOnly;
            localizeHeaders( network_data, data );
            if( eventData.tableName && data.engrTable[ eventData.tableName ] ) {
                complexDataService.setRange( eventData.tableData, data.engrTable[ eventData.tableName ] );
            }
            make_d3_table( eventData.tableData, data.engrTable );
        } else{
            network_data = eventData.tableData;
        }
    }
};

export let loadEngrTableCtx = function( engrTable ) {
    let engrTableUpdated = engrTable;
    engrTableUpdated.network_data = network_data;
    engrTableUpdated.tableModel = { readOnly: network_data.readOnly, tableData: network_data, tableName: network_data.tableName };
    return{
        engrTable : engrTableUpdated
    };
};
let refreshTable = function( eventData, engrTable ) {
    if( engrTable ) {
        let engrTableUpdated = engrTable;
        engrTableUpdated.network_data = eventData.tableData;
    }
    if( eventData && eventData.tableData ) {
        d3.select( '#main_svg' ).remove();
        d3.select( '#' + eventData.tableData.tableName )
            .append( 'svg' )
            .attr( 'id', 'main_svg' )
            .attr( 'class', 'aw-engrtable-mainSvg' )
            .attr( 'overflow', 'auto' );
        setColumnWidths( eventData.tableData.columnHeaders );

        network_data = eventData.tableData;
        network_data.readOnly = eventData.readOnly;
        clearSelection( engrTable );

        make_d3_table( eventData.tableData, engrTable );
        if( network_data.editMode ) {
            d3.selectAll( '.aw-engrtable-cell .cell' )
                .style( 'stroke-width', function( d ) {
                    return d.editable ? 3 : 0.7;
                } );
        }
    }
};

let setColumnWidths = function( headers ) {
    headers.forEach( header => {
        if( !header.width ) {
            header.width = cell_width;
        }
    } );
};

/**
 * Gets property display names for Goal, Min, Max and Measurement.
 * @param {*} selectedParameter Parameter selected
 * @returns {*} property display names
 */
export let getEngrDisplayPropNames = ( selectedParameter )=>{
    let currentValueObject = cdm.getObject( selectedParameter.props.att0CurrentValue.dbValues[0] );
    let measurementDisplayName = currentValueObject.modelType.propertyDescriptorsMap.att0Value.displayName;

    return {
        Goal: selectedParameter.props.att0Goal.propertyDescriptor.displayName,
        Max: selectedParameter.props.att0Max.propertyDescriptor.displayName,
        Min: selectedParameter.props.att0Min.propertyDescriptor.displayName,
        Measurement: measurementDisplayName
    };
};

/**
 * Gets property display names for Goal, Min, Max and Measurement.When selected parameter have DCP props.
 * @param {*} selectedParam Parameter selected
 * @returns {*} property display names
 */
export let getGMMMDisplayNames = ( selectedParam, selectedVMO, data )=>{
    var goalValue = selectedParam?.props.att0Goal?.propertyDescriptor?.displayName;
    var minValue = selectedParam?.props.att0Min?.propertyDescriptor?.displayName;
    var maxValue = selectedParam?.props.att0Max?.propertyDescriptor?.displayName;
    var measurementValue = undefined;
    if( selectedVMO ) {
        measurementValue = selectedVMO?.props['REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0CurrentValue,Att0MeasureValueDbl).att0Value']?.propertyDisplayName;
    } else {
        var currentValueObject = cdm.getObject( selectedParam?.props?.att0CurrentValue?.dbValues[0] );
        measurementValue = currentValueObject?.modelType?.propertyDescriptorsMap?.att0Value?.displayName;
    }
    return {
        Goal: goalValue ? goalValue : data.i18n.Goal,
        Max: maxValue ? maxValue : data.i18n.Max,
        Min: minValue ? minValue : data.i18n.Min,
        Measurement: measurementValue ? measurementValue : data.i18n.Measurement
    };
};

export let localizeHeaders = function( tableData, data ) {
    let selectedParam = data.selectedParameter ?? data.engrTable.selectedParameter;
    let propertyDisplayNames;
    if( data.engrTable.propertyDisplayNames ) {
        propertyDisplayNames = data.engrTable.propertyDisplayNames;
    } else if( data.subPanelContext.parametersTable ) {
        propertyDisplayNames = getGMMMDisplayNames( selectedParam, data.subPanelContext.parametersTable.selectedObjects[0], data );
    } else if( data.subPanelContext.openedObject ) {
        propertyDisplayNames = getGMMMDisplayNames( data.subPanelContext.openedObject, undefined, data );
    }

    var headers = {};

    tableData.subHeaders.forEach( header => {
        let propDisplayName = propertyDisplayNames[header];
        headers[ header ] = propDisplayName ? propDisplayName : header;
    } );

    tableData.headers = headers;
};


/**
 * Remove dirty indicator from modified cells.
 */
let clearDirty = function() {
    network_data.cells.forEach( row => {
        row.forEach( cell => {
            cell.isDirty = undefined;
        } );
    } );
    network_data.rowHeaders.forEach( cell => {
        cell.isDirty = false;
    } );
    network_data.columnHeaders.forEach( cell => {
        cell.isDirty = false;
    } );
    d3.selectAll( '.g-cell' ).each( function( d ) {
        d.isDirty = false;
    } );
    d3.selectAll( '.cell' ).classed( 'dirty', false );
};

let removeInputField = function() {
    try {
        d3.selectAll( 'foreignObject' ).remove();
    } catch ( error ) {
        // ignore
    }
};

/**
 * Save the data entered into d3 table
 * @param {boolean} refresh if true refresh entire view
 * @param {boolean} keepState if false exit edit mode
 */
export let updateChangesEngrTable = function( keepState, engrTableUpdated ) {
    network_data = engrTableUpdated.network_data;
    var tableName = engrTableUpdated.tableModel.tableName;
    engrTableUpdated[ tableName ].isDirty = undefined;
    engrTableUpdated[ tableName ].undo = false;
    engrTableUpdated[ tableName ].isEditing = undefined;

    engrTableUpdated.att1IsAutoSaveDisabedInEngrTable = undefined;
    if( engrTableUpdated.network_data.editMode ) {
        if( !keepState ) {
            engrTableUpdated.network_data.editMode = false;
            clearDirty();
        }
        removeInputField();
    }
    var json;
    if( engrTableUpdated.network_data.tableName === 'valueTable' ) {
        json = createJson( true );
        engrTableUpdated.valueTable.tableName = json;
        eventBus.publish( 'saveAttributeComplexMeasurementSoaCall' );
    } else {
        json = createJson();
        engrTableUpdated.goalTable.tableName = json;
        eventBus.publish( 'setAttributeComplexDataSoaCallSave' );
    }
};
export let saveEditEngrTable = function( engrTable, keepState ) {
    let engrTableUpdated = {};
    var isCalledFromOwnViewModel = false;
    if( engrTable.value ) {
        engrTableUpdated = { ...engrTable.value };
    } else {
        isCalledFromOwnViewModel = true;
        engrTableUpdated = engrTable;
    }
    engrTableUpdated.network_data = network_data;
    var tableName = engrTableUpdated.tableModel.tableName;
    engrTableUpdated[ tableName ].isDirty = undefined;
    engrTableUpdated[ tableName ].isEditing = undefined;
    engrTableUpdated[ tableName ].undo = false;

    engrTableUpdated.att1IsAutoSaveDisabedInEngrTable = undefined;
    if( engrTableUpdated.network_data.editMode ) {
        if( !keepState ) {
            engrTableUpdated.network_data.editMode = false;
            network_data.editMode = false;
            clearDirty();
            clearSelection( engrTableUpdated );
        }
        removeInputField();
        refreshTable( { tableData: engrTableUpdated.network_data }, engrTableUpdated );
        eventBus.publish( 'Att1MeasurementsView.updateLineChart' );
    }
    var json;
    if( engrTableUpdated.network_data.tableName === 'valueTable' ) {
        json = createJson( true );
        engrTableUpdated.valueTable.tableName = json;
        engrTableUpdated.tableModel.tableData = network_data;
        if( !isCalledFromOwnViewModel ) {
            engrTable.update( engrTableUpdated );
        }
        eventBus.publish( 'saveAttributeComplexMeasurementSoaCall', { refresh: false } );
    } else {
        json = createJson();
        engrTableUpdated.goalTable.tableName = json;
        engrTableUpdated.tableModel.tableData = network_data;
        if( !isCalledFromOwnViewModel ) {
            engrTable.update( engrTableUpdated );
        }
        eventBus.publish( 'setAttributeComplexDataSoaCallSave' );
    }
    if( isCalledFromOwnViewModel ) {
        return { engrTable: engrTableUpdated };
    }
};

export let getSelectedParameter = function() {
    return m_selectedParameter;
};

let showErrorMsgForUpdateParameters2 = function( error ) {
    if( error && error.cause && error.cause.partialErrors && error.cause.partialErrors.length > 0 &&
        error.cause.partialErrors[ 0 ].errorValues && error.cause.partialErrors[ 0 ].errorValues.length > 0 &&
        error.cause.partialErrors[ 0 ].errorValues[ 0 ].message ) {
        var errorMsg = error.cause.partialErrors[ 0 ].errorValues[ 0 ].message;
        msgSvc.showError( errorMsg );
    }
};

/**
 * Render the table.
 * @param {*} tableData data for table
 */
export let make_d3_table = function( tableData, engrTable ) {
    var max_col_height = 0;
    var max_col_width = 0;
    var main_svg = d3.select( '#main_svg' );

    // initialize matrix
    matrix = [];
    tableData.headerRowCount = tableData.showSubHeaders ? 2 : 1;
    if( tableData.hasColumnSeries ) {
        tableData.headerRowCount++;
    }
    tableData.headerColCount = tableData.hasRowHeaders ? 2 : 1;
    tableData.totalColumns = tableData.numValues * ( tableData.columnHeaders.length - 1 ) + tableData.headerColCount;
    tableData.totalRows = tableData.rowHeaders.length + tableData.headerRowCount;
    for( var i = 0; i < tableData.totalRows; i++ ) {
        matrix[ i ] = [];
        for( var j = 0; j < tableData.totalColumns; j++ ) {
            matrix[ i ][ j ] = {
                pos_x: j,
                pos_y: i,
                text: '',
                cellType: '',
                editable: false
            };
        }
    }

    for( i = 0; i < tableData.headerRowCount; i++ ) {
        for( j = 0; j < tableData.headerColCount; j++ ) {
            matrix[ i ][ j ].cellType = 'table';
        }
    }

    tableData.displayWidth = [];
    var colIndex = 0;
    var colHeaderRow = tableData.hasColumnSeries ? 1 : 0;
    matrix[ colHeaderRow ][ 0 ].rowType = 'header';
    tableData.columnHeaders.forEach( function( column ) {
        var headerCol = ( colIndex - 1 ) * tableData.numValues + tableData.headerColCount;
        var colCell = matrix[ colHeaderRow ][ headerCol ];
        if( colIndex === 0 ) {
            headerCol = tableData.hasRowHeaders ? 1 : 0;
            colCell = matrix[ colHeaderRow ][ headerCol ];
        }
        colCell.units = column.units;
        colCell.displayText = column.displayText;
        colCell.text = column.text;
        colCell.index = colIndex;
        colCell.cellType = 'column';
        colCell.width = column.width;
        colCell.span = colIndex === 0 ? 1 : tableData.numValues;
        colCell.editable = !tableData.readOnly && tableData.tableName !== 'valueTable';
        colCell.series = column.series;
        tableData.displayWidth[ headerCol ] = colCell.width;
        if( tableData.editMode ) {
            colCell.isDirty = column.isDirty;
        }
        if( tableData.showSubHeaders && colIndex > 0 ) {
            for( var i = 0; i < tableData.numValues; i++ ) {
                matrix[ colHeaderRow + 1 ][ headerCol + i ].text = tableData.headers[ tableData.displayHeaders[ i ] ];
                matrix[ colHeaderRow + 1 ][ headerCol + i ].displayText = tableData.headers[ tableData.displayHeaders[ i ] ];
                matrix[ colHeaderRow + 1 ][ headerCol + i ].cellType = 'column';
                matrix[ colHeaderRow + 1 ][ headerCol + i ].subHeader = true;
                matrix[ colHeaderRow + 1 ][ headerCol + i ].index = colIndex;
                tableData.displayWidth[ headerCol + i ] = colCell.width;
            }
            matrix[ colHeaderRow + 1 ][ 0 ].cellType = 'table';
        }
        colIndex++;
    } );

    tableData.displayWidth[ 0 ] = tableData.cells.length > 999 ? 36 : 24;
    tableData.columnStart = [];
    var x = 0;
    for( i = 0; i < tableData.totalColumns; i++ ) {
        tableData.columnStart.push( x );
        x += tableData.displayWidth[ i ] ? tableData.displayWidth[ i ] : cell_width;
    }
    max_col_height = x;

    var rowIndex = 0;
    tableData.rowHeaders.forEach( function( row ) {
        var rowCell = matrix[ tableData.headerRowCount + rowIndex ][ 0 ];
        rowCell.text = ( rowIndex + 1 ).toString();
        rowCell.index = rowIndex;
        rowCell.cellType = 'row';
        rowCell.subHeader = true;
        rowCell.editable = false;
        rowCell.isDirty = false;
        if( tableData.hasRowHeaders ) {
            rowCell = matrix[ tableData.headerRowCount + rowIndex ][ 1 ];
            rowCell.text = row.text;
            rowCell.displayText = row.text;
            rowCell.index = rowIndex;
            rowCell.cellType = 'row';
            rowCell.editable = !tableData.readOnly && tableData.tableName !== 'valueTable';
            if( tableData.editMode ) {
                rowCell.isDirty = row.isDirty;
            }
        }
        rowIndex++;
    } );

    for( i = 0; i < tableData.columnSeries.length; i++ ) {
        var series = tableData.columnSeries[ i ];
        if( series.count === 0 ) {
            continue;
        }
        var col = ( series.start - 1 ) * tableData.numValues + tableData.headerColCount;
        matrix[ 0 ][ col ].text = series.text;
        matrix[ 0 ][ col ].displayText = series.displayText;
        matrix[ 0 ][ col ].units = series.units;
        matrix[ 0 ][ col ].span = series.count * tableData.numValues;
        matrix[ 0 ][ col ].cellType = 'series';
        matrix[ 0 ][ col ].editable = !tableData.readOnly;
        matrix[ 0 ][ col ].index = i;
        series.free = series.count === 1 && series.text === '';
    }

    var isGmmEditable = tableData.tableName !== 'valueTable' && !tableData.readOnly;
    // Add values to cells
    tableData.cells.forEach( function( row ) {
        row.forEach( function( cell ) {
            var target = cell.target * tableData.numValues + tableData.headerColCount;
            var source = cell.source + tableData.headerRowCount;
            for( var i = 0; i < tableData.numValues; i++ ) {
                var matrixCell = matrix[ source ][ target + i ];
                matrixCell.text = cell[ tableData.displayHeaders[ i ] ] ? cell[ tableData.displayHeaders[ i ] ] : '';
                matrixCell.cellType = cell.cellType;
                matrixCell.index = tableData.displayHeaders[ i ];
                matrixCell.target = cell.target;
                matrixCell.source = cell.source;
                matrixCell.editable = i > 0 ? isGmmEditable : !tableData.readOnly;
                if( tableData.editMode ) {
                    matrixCell.isDirty = isDirty( cell, matrixCell.index );
                }
            }
        } );
    } );
    tableData.max_row_height = tableData.totalRows * cell_height;

    var size = set_visualization_size( tableData );
    renderD3Table( main_svg, tableData, max_col_height, max_col_width, engrTable );
    renderDataArea( tableData, size, engrTable );
    _transformSvgOnScroll();
};

/**
 * Display the table.
 * @param {*} main_svg Top SVG element for table.
 * @param {*} tableData The table data
 * @param {*} max_col_height Maximum height of table
 * @param {*} max_col_width Maximum wioth of table
 */
let renderD3Table = function( main_svg, tableData, max_col_height, max_col_width, engrTable ) {
    var main_svg_height = max_col_width + tableData.max_row_height + 1;
    main_svg.attr( 'x', 0 )
        .attr( 'y', 0 )
        .attr( 'width', max_col_height + max_col_width + 20 )
        .attr( 'height', main_svg_height );
    var matrix_cluster = main_svg.append( 'g' )
        .attr( 'id', 'matrix_cluster' ).attr( 'class', 'aw-engrtable-cluster' );
    createDataArea( tableData, matrix_cluster );
    var boderLines = matrix_cluster.append( 'g' )
        .attr( 'class', 'aw-engrtable-dividers' );
    var rowHeaderArea = createRowHeaders( tableData, matrix_cluster );
    var columnHeaderArea = createColumnHeaders( tableData, matrix_cluster );
    var tableHeaderCells = createTableHeaders( tableData, matrix_cluster );

    addColumnResizeControls( columnHeaderArea, tableData );

    // Move resize control for row headers to table header area so it remains in correct position while scrolling
    if( tableData.hasRowHeaders ) {
        var element = columnHeaderArea.select( '.aw-engrTable-columnSizeControl' );
        tableHeaderCells.append( function() {
            return element.node();
        } );
    }

    boderLines
        .append( 'line' )
        .attr( 'x1', max_col_height )
        .attr( 'y1', 0 )
        .attr( 'x2', max_col_height )
        .attr( 'y2', main_svg_height );
    boderLines
        .append( 'line' )
        .attr( 'x1', 0 )
        .attr( 'y1', 0 )
        .attr( 'x2', max_col_height )
        .attr( 'y2', 0 );
    boderLines
        .append( 'line' )
        .attr( 'x1', 0 )
        .attr( 'y1', main_svg_height )
        .attr( 'x2', max_col_height )
        .attr( 'y2', main_svg_height );
};

/**
 * Create the row header section of the table
 * @param {*} tableData The table data
 * @param {*} parent D3 parent element for header
 * @returns {*} D3 element for row header section
 */
let createRowHeaders = function( tableData, parent ) {
    var rowHeaderArea = parent.append( 'g' )
        .attr( 'class', 'rowHeader-area' )
        .selectAll( '.row' )
        .data( matrix.slice( tableData.headerRowCount ) )
        .enter()
        .append( 'g' )
        .classed( 'row_header_lines', true )
        .attr( 'transform', function( d, i ) {
            return 'translate (0,' + ( i + tableData.headerRowCount ) * cell_height + ')';
        } )
        .each( function( d ) {
            row_function( d, this, tableData );
        } );
    rowHeaderArea.selectAll( '.aw-engrtable-rowNumber text' ).attr( 'dx', columnWidth( 0 ) / 2 - 6 );
    rowHeaderArea.selectAll( '.aw-engrtable-rowHeader text' ).each( function( d ) {
        truncateCellText( d, d3.select( this ) );
    } );
    addHeaderBehavior( tableData, rowHeaderArea );
    return rowHeaderArea;
};

/**
 * Create the column header section of the table
 * @param {*} tableData The table data
 * @param {*} parent D3 parent element for header
 * @returns {*} D3 element for column header section
 */
let createColumnHeaders = function( tableData, parent ) {
    var columnHeaderCells = parent.append( 'g' )
        .attr( 'class', 'columnHeader-area' );
    columnHeaderCells
        .selectAll( '.row' )
        .data( matrix.slice( 0, tableData.headerRowCount ) )
        .enter()
        .append( 'g' )
        .classed( 'column_header_lines', true )
        .attr( 'transform', function( d, i ) {
            return 'translate (0,' + i * cell_height + ')';
        } )
        .each( function( d ) {
            row_function( d, this, tableData );
        } );
    columnHeaderCells.selectAll( '.aw-engrtable-header' )
        .classed( 'merge', function( d ) { return d.cellType === ''; } );
    columnHeaderCells.selectAll( '.aw-engrtable-seriesHeader text' )
        .attr( 'x', function( d ) {
            return columnStart( d.pos_x ) + d.w / 2;
        } );
    columnHeaderCells.selectAll( '.merge' ).remove();
    addHeaderBehavior( tableData, columnHeaderCells );
    return columnHeaderCells;
};

let createTableHeaders = function( tableData, parent ) {
    var tableHeaderCells = parent.append( 'g' )
        .attr( 'class', 'tableHeader-area' );
    tableHeaderCells
        .selectAll( '.row' )
        .data( matrix.slice( 0, tableData.headerRowCount ) )
        .enter()
        .append( 'g' )
        .attr( 'class', 'table_header_lines' )
        .attr( 'transform', function( d, i ) {
            return 'translate (0,' + i * cell_height + ')';
        } )
        .each( function( d ) {
            row_function( d, this, tableData );
        } );
    addHeaderBehavior( tableData, tableHeaderCells );
    if( tableData.hasRowHeaders ) {
        tableHeaderCells.selectAll( '.aw-engrtable-tableHeader text' ).each( function( d ) {
            truncateCellText( d, d3.select( this ) );
        } );
    }

    tableHeaderCells.select( '#g-cell0-0' )
        .on( 'contextmenu', function( d ) {
            d3.event.preventDefault();
            d3.selectAll( '.cell' ).classed( 'selected-cell', true );
            setSelection( d );
            d3.event.stopPropagation();
            eventBus.publish( 'engrTable.showContextMenuPopup', { event: d3.event, selection: [ d ] } );
        } );
    var selectAllIcon = tableHeaderCells.select( '#g-cell0-0' ).append( 'g' )
        .attr( 'transform', 'translate (' + ( columnStart( 1 ) - 16 ) + ',14)' );
    selectAllIcon.append( 'path' )
        .attr( 'class', 'aw-theme-iconOutline' )
        .attr( 'd', 'M2.789,12.998c-0.046-0.139,0-0.278,0.093-0.371l9.745-9.745c0.093-0.093,0.232-0.139,0.371-0.093c0.17,0.058,0.205,0.15,0.232,0.325v9.745c0,0.186-0.139,0.325-0.325,0.325L3.113,13.23C2.944,13.184,2.817,13.068,2.789,12.998zM12.306,4.616l-7.668,7.668l7.621-0.031L12.306,4.616z' );
    selectAllIcon.append( 'rect' )
        .attr( 'x', 3 )
        .attr( 'y', 3 )
        .attr( 'width', 11 )
        .attr( 'height', 11 )
        .attr( 'opacity', 0 )
        .on( 'click', function() {
            setSelections( [ matrix[0][0] ] );
            d3.event.stopPropagation();
        } );
    return tableHeaderCells;
};

let getCellWidth = function( data ) {
    return data.w;
};

/**
 * Set the width of a table column.
 * @param {*} column Column number
 * @param {*} width New with in pixels
 * @param {*} tableData The table data
 */
let setColumnWidth = function( column, width, tableData ) {
    tableData.columnHeaders[ column ].width = Math.max( min_cell_width, width );
};
/**
 * Return the starting coordinate of the given column.
 * @param {int} col The column number
 * @param {*} data The table data
 * @returns {int} The start x pixel coordinate for column
 */
let getColumnStart = function( col, data ) {
    if( col === 0 ) {
        return columnStart( 1 ) + ( data.hasRowHeaders ? data.columnHeaders[ col ].width : 0 );
    }
    return columnStart( ( col - 1 ) * data.numValues + data.headerColCount ) + data.columnHeaders[ col ].width * data.numValues;
};

/**
 * Event handler for table scrolling. Used to freeze row and column headers.
 */
const _transformSvgOnScroll = () => {
    const matrixContainer = document.querySelector( '#' + network_data.tableName );
    if( matrixContainer ) {
        transformHeaders( matrixContainer );
        matrixContainer.addEventListener( 'scroll', event => {
            transformHeaders( matrixContainer );
        } );
    }
};

/**
 * Add resize control to each column in the table.
 * @param {*} columnHeaderCells D3 elements for column headers
 * @param {*} tableData The table data
 */
let addColumnResizeControls = function( columnHeaderCells, tableData ) {
    var resizeStart = 0;
    var dragResizeHeader = d3.drag()
        .on( 'start', function() {
            resizeStart = d3.select( this ).attr( 'x1' );
        } )
        .on( 'drag', function() {
            d3.select( this ).attr( 'x1', d3.event.x ).attr( 'x2', d3.event.x )
                .attr( 'style', 'opacity: 1; stroke-width: 1;' ).attr( 'y2', tableData.max_row_height );
        } )
        .on( 'end', function( d, i ) {
            var resizeData = d3.select( this ).data();
            if( resizeStart === d3.select( this ).attr( 'x1' ) ) {
                d3.select( this ).attr( 'style', '' );
                return;
            }
            var offset = d3.event.x - resizeStart;
            var range = d3.select( this ).classed( 'range' );
            eventBus.publish( 'engrTable.resizeColumn', { resizeStart: resizeStart, resizeData: resizeData, offset: offset, range: range, index: i, tableData: tableData } );
        } );

    columnHeaderCells.selectAll( '.col_resize' )
        .data( tableData.columnHeaders )
        .enter()
        .append( 'line' )
        .attr( 'x1', function( d, i ) {
            return getColumnStart( i, tableData );
        } )
        .attr( 'y1', tableData.hasColumnSeries ? cell_height : 0 )
        .attr( 'x2', function( d, i ) {
            return getColumnStart( i, tableData );
        } )
        .attr( 'y2', tableData.hasColumnSeries ? cell_height * 2 : cell_height )
        .attr( 'class', 'aw-engrTable-columnSizeControl column' )
        .on( 'dblclick', function( d, i ) {
            d3.event.preventDefault();
            if( tableData.showSubHeaders ) {
                return;
            }
            var col = tableData.hasRowHeaders ? i + 1 : i;
            var newWidth = min_cell_width;
            for( var row = tableData.hasColumnSeries ? 1 : 0; row < tableData.cells.length + tableData.headerRowCount; row++ ) {
                var textObject = d3.select( '.text' + row + '-' + col );
                if ( !textObject.empty() ) {
                    var data = textObject.data()[0];
                    if ( data.cellType === 'row' && textObject.text() !== data.text ) {
                        textObject.text( data.text );
                    }
                    if ( tableData.hasRowHeaders && data.cellType === 'column' && data.pos_x === 1 && textObject.text() !== data.displayText ) {
                        textObject.text( data.displayText );
                    }
                    newWidth = Math.max( newWidth, textObject.node().textLength.baseVal.value + 12 );
                }
            }
            tableData.columnHeaders[ i ].width = Math.floor( newWidth );
            eventBus.publish( 'engrTable.dblcolumnResize', { tableData: tableData } );
        } )
        .call( dragResizeHeader );

    if( tableData.showSubHeaders ) {
        for( var subIdx = 1; subIdx <= tableData.numValues; subIdx++ ) {
            columnHeaderCells.selectAll( '.col_line' )
                .data( tableData.columnHeaders.slice( 1 ) )
                .enter()
                .append( 'line' )
                .attr( 'x1', function( d, i ) {
                    return getColumnStart( i, tableData ) + d.width * subIdx;
                } )
                .attr( 'y1', tableData.hasColumnSeries ? cell_height * 2 : cell_height )
                .attr( 'x2', function( d, i ) {
                    return getColumnStart( i, tableData ) + d.width * subIdx;
                } )
                .attr( 'y2', cell_height * tableData.headerRowCount )
                .attr( 'class', 'aw-engrTable-columnSizeControl range' )
                .call( dragResizeHeader );
        }
    }

    // add series resize controls
    if( tableData.hasColumnSeries ) {
        columnHeaderCells.selectAll( '.col_line' )
            .data( tableData.columnSeries )
            .enter()
            .append( 'line' )
            .attr( 'x1', function( d ) {
                return getColumnStart( d.start + d.count - 1, tableData );
            } )
            .attr( 'y1', 0 )
            .attr( 'x2', function( d ) {
                return getColumnStart( d.start + d.count - 1, tableData );
            } )
            .attr( 'y2', cell_height )
            .attr( 'class', 'aw-engrTable-columnSizeControl series' )
            .call( dragResizeHeader );
    }
};

export let resizeColumn = function( resizeStart, resizeData, offset, range, index, tableData, engrTable ) {
    var engrTableUpdated = engrTable;
    var selection = getSelections( engrTableUpdated );
    engrTableUpdated.network_data = tableData;
    var span = tableData.hasRowHeaders && parseInt( resizeStart ) === tableData.columnStart[ 2 ] ? 1 : tableData.numValues;

    var newWidth;
    if( resizeData[ 0 ].count > 0 ) {
        offset = Math.floor( offset / resizeData[ 0 ].count / span );
        for( var j = 0; j < resizeData[ 0 ].count; j++ ) {
            newWidth = tableData.columnHeaders[ resizeData[ 0 ].start + j ].width + offset;
            setColumnWidth( resizeData[ 0 ].start + j, newWidth, tableData );
        }
    } else {
        offset = Math.floor( offset / ( range ? 1 : span ) );
        newWidth = resizeData[ 0 ].width + offset;
        if( selection && selection.length > 1 && selection[ 0 ].cellType === 'column' && !tableData.showSubHeaders ) {
            selection.forEach( header => {
                setColumnWidth( header.pos_x - ( tableData.hasRowHeaders ? 1 : 0 ), newWidth, tableData );
            } );
        } else {
            setColumnWidth( range ? index + 1 : index, resizeData[ 0 ].width + offset, tableData );
        }
    }
    resizeStart = 0;
    saveChanges( tableData, engrTableUpdated );
    if( selection ) {
        setSelections( selection );
    }
};

export let dblresizeColumn = function( tableData, engrTable ) {
    engrTable.network_data = tableData;
    saveChanges( tableData, engrTable );
};

/**
 * Shift the row and column headers so they remain visible after scrolling.
 * @param {*} matrixContainer Table element
 */
let transformHeaders = function( matrixContainer ) {
    var scrollLeft = -1;
    var scrollTop = -1;
    if( scrollLeft !== matrixContainer.scrollLeft ) {
        // horizontally scrolled
        scrollLeft = matrixContainer.scrollLeft;
        d3.select( '.rowHeader-area' )
            .attr( 'transform', `translate(${scrollLeft},0)` );
    }
    if( scrollTop !== matrixContainer.scrollTop ) {
        // vertical scrolled
        scrollTop = matrixContainer.scrollTop;
        d3.selectAll( '.columnHeader-area' )
            .attr( 'transform', `translate(0,${scrollTop})` );
    }
    // Upper left of table frozen both ways
    scrollLeft = matrixContainer.scrollLeft;
    d3.select( '.tableHeader-area' )
        .attr( 'transform', `translate(${scrollLeft},${scrollTop})` );
};

/**
 * Render cells in the table.
 * @param {*} row_data Cell data array for the current row
 * @param {*} group Group for new cells, row header, column header, data, or upper left
 * @param {*} tableData Data for the table
 */
export let row_function = function( row_data, group, tableData ) {
    // generate tiles in the current row
    var cell = d3.select( group );
    if( cell.classed( 'row_lines' ) ) {
        cell.selectAll( '.cell' )
            .data( row_data.slice( tableData.headerColCount ) )
            .enter()
            .append( 'g' )
            .attr( 'class', 'g-cell aw-engrtable-cell' );
    } else if( cell.classed( 'column_header_lines' ) ) {
        cell.selectAll( '.cell' )
            .data( row_data.slice( tableData.headerColCount ) )
            .enter()
            .append( 'g' )
            .attr( 'class', 'g-cell aw-engrtable-header' )
            .classed( 'aw-engrtable-columnHeader', function( d ) {
                return d.cellType === 'column';
            } )
            .classed( 'aw-engrtable-seriesHeader', function( d ) {
                return d.cellType === 'series';
            } );
    } else {
        cell.selectAll( '.cell' )
            .data( row_data.slice( 0, tableData.headerColCount ) )
            .enter()
            .append( 'g' )
            .attr( 'class', 'g-cell aw-engrtable-header' )
            .classed( 'aw-engrtable-rowHeader', function( d ) {
                return d.pos_y >= tableData.headerRowCount;
            } )
            .classed( 'aw-engrtable-rowNumber', function( d ) {
                return d.pos_x === 0 && d.pos_y >= tableData.headerRowCount;
            } )
            .classed( 'aw-engrtable-tableHeader', function( d ) {
                return d.pos_y < tableData.headerRowCount;
            } );
    }

    cell.selectAll( '.g-cell' )
        .attr( 'id', function( d ) {
            return String( 'g-cell' + d.pos_y + '-' + d.pos_x );
        } )
        .append( 'rect' )
        .attr( 'class', function( d ) {
            return String( 'cell' + ' cell' + d.pos_y + '-' + d.pos_x );
        } )
        .classed( 'dirty', function( d ) { return d.isDirty; } )
        .attr( 'x', function( d ) {
            return columnStart( d.pos_x );
        } )
        .attr( 'tabindex', 0 )
        .classed( 'inactive', function( d ) { return d.pos_y === '' && d.pos_x === ''; } )
        .attr( 'y', 0 )
        .attr( 'width', function( d ) {
            d.w = d.span ? columnWidth( d.pos_x, d.span ) : columnWidth( d.pos_x );
            return d.w;
        } )
        .attr( 'height', cell_height );
    cell.selectAll( '.g-cell' ).append( 'text' )
        .attr( 'class', function( d ) {
            return String( 'text' + d.pos_y + '-' + d.pos_x );
        } )
        .attr( 'x', function( d ) {
            return columnStart( d.pos_x ) + 6;
        } )
        .attr( 'y', 20 )
        .text( function( d ) {
            if( d.displayText ) {
                return d.displayText;
            }
            return d.text ? d.text : '';
        } );
};

/**
 * Add event listeners to data cells
 * @param {*} tableData The table data
 */
let addCellBehavior = function( tableData ) {
    d3.select( '.data-area' ).selectAll( '.g-cell' )
        .on( 'mouseover', function( d ) {
            // show popup
            //showPopup( d );
            eventBus.publish( 'engrTable.showGMMEditPopup', { d: d } );
        } )
        .on( 'keydown', function() {
            handleKeyboard( d3.event );
        } )
        .on( 'dblclick', function( d ) {
            // double clicking cell opens cell editor
            isDoubleClick = true;
            if( !tableData.editMode ) {
                let cell = getCell( d.pos_y, d.pos_x );
                let isCellSelected = isSelected( d );
                if( !cell.empty() && !isCellSelected ) {
                    selectCell( d.pos_y, d.pos_x );
                }
                editCell( d3.select( this ) );
            }
        } ).call( dragSelect )
        .on( 'contextmenu', function( d ) {
            // select cell and show context popup
            d3.event.preventDefault();
            if( !d.isEditing && !tableData.editMode && !isSelected( d ) ) {
                selectCell( d.pos_y, d.pos_x );
            }
            eventBus.publish( 'engrTable.showContextMenuPopup', { event: d3.event, selection: [ d ] } );
        } )
        .on( 'click', function( d ) {
            if ( !d.isEditing && !tableData.editMode ) {
                selectCell( d.pos_y, d.pos_x );
            } else if ( !d.isEditing ) {
                editCell( d3.select( this ) );
                selectCell( d.pos_y, d.pos_x );
            }
        } );
};

/**
 * Add event listeners for header cells.
 * @param {*} tableData The table data
 * @param {*} area The table header section
 */
let addHeaderBehavior = function( tableData, area ) {
    area.selectAll( '.aw-engrtable-header' )
        .on( 'contextmenu', function( d ) {
            d3.event.preventDefault();
            setSelection( d );
            eventBus.publish( 'engrTable.showContextMenuPopup', { event: d3.event, selection: [ d ] } );
        } )
        .on( 'keydown', function() {
            handleKeyboard( d3.event );
        } )
        .on( 'click', function( d ) {
            if( d.isEditing ) {
                return;
            }
            setSelection( d );
            d3.select( this ).select( '.cell' ).node().focus();
            if( tableData.editMode && ( d.cellType === 'column' || d.cellType === 'series' ) && d.units !== undefined && d.units !== '' ) {
                eventBus.publish( 'engrTable.showUpdateUomPopup' );
            }
        } )
        .on( 'dblclick', function( d ) {
            if( ( d.cellType === 'column' || d.cellType === 'series' ) && d.units !== undefined && d.units !== '' ) {
                eventBus.publish( 'engrTable.showUpdateUomPopup' );
            } else {
                var cell = d3.select( this );
                editCell( d3.select( this ) );
            }
        } ).call( dragSelect );
};

/**
 * Create the data section of the table.
 * @param {*} tableData The table data
 * @param {*} parent Parent D3 element for data section
 */
let createDataArea = function( tableData, parent ) {
    tableData.dataAreaY = cell_height * tableData.headerRowCount;
    tableData.dataAreaX = columnStart( tableData.headerColCount );
    parent.append( 'g' )
        .attr( 'class', 'data-area' );
    if( tableData.showSubHeaders ) {
        d3.select( '.data-area' ).append( 'g' )
            .attr( 'class', 'aw-engrtable-dataDividers' )
            .selectAll( '.col_line' )
            .data( tableData.columnHeaders.slice( tableData.headerColCount ) )
            .enter()
            .append( 'line' )
            .attr( 'x1', function( d, i ) {
                return columnStart( ( i + 1 ) * tableData.numValues + tableData.headerColCount );
            } )
            .attr( 'y1', tableData.dataAreaY )
            .attr( 'x2', function( d, i ) {
                return columnStart( ( i + 1 ) * tableData.numValues + tableData.headerColCount );
            } )
            .attr( 'y2', tableData.max_row_height );
    }
};

let dragSelect = d3.drag()
    .on( 'drag', function( cell ) {
        if( cell.isEditing ) {
            return;
        }
        var col = 0;
        for( var i = 0; i < network_data.columnStart.length; i++ ) {
            if( network_data.columnStart[ i ] > d3.event.x ) {
                break;
            }
        }
        col = i - 1;
        var row = Math.floor( cell.pos_y + d3.event.y / cell_height );
        if( cell.cellType !== 'cell' || row !== cell.pos_y || col !== cell.pos_x ) {
            var maxRow = Math.max( row, cell.pos_y );
            var minRow = Math.min( row, cell.pos_y );
            var maxCol = Math.max( col, cell.pos_x );
            var minCol = Math.min( col, cell.pos_x );
            clearSelections();
            d3.selectAll( '.cell' ).classed( 'selected-cell', function( d ) {
                switch ( cell.cellType ) {
                    case 'row':
                        return d.pos_y >= minRow && d.pos_y <= maxRow && d.cellType !== 'series';
                    case 'column':
                        return d.pos_x >= minCol && d.pos_x <= maxCol && d.cellType !== 'series' && ( d.cellType !== 'column' || d.span );
                }
                return d.pos_y >= minRow && d.pos_y <= maxRow && d.pos_x >= minCol && d.pos_x <= maxCol;
            } );
            if( cell.cellType === 'column' ) {
                var columns = d3.selectAll( '.aw-engrtable-columnHeader .selected-cell' ).data();

                if( columns.length > 0 ) {
                    eventBus.publish( 'engrTable.updateSelection', { selection: columns, dragType: cell.cellType, minCol: columns[ 0 ].index, maxCol: columns[ columns.length - 1 ].index } );
                } else {
                    eventBus.publish( 'engrTable.updateSelection', { selection: columns } );
                }
            } else if( cell.cellType === 'row' ) {
                var rows = d3.selectAll( '.aw-engrtable-rowHeader .selected-cell' ).data();
                rows = getUniqueRows( rows );
                eventBus.publish( 'engrTable.updateSelection', { selection: rows, dragType: cell.cellType, minCol: rows[ 0 ].index, maxCol: rows[ rows.length - 1 ].index } );
            } else {
                var selection = d3.selectAll( '.selected-cell' ).data();
                eventBus.publish( 'engrTable.updateSelection', { selection: selection } );
            }
            focusCell( row, col );
        }
    } ).on( 'end', function( data ) {
        //eventBus.publish( 'Att1MeasurementsView.updateLineChartWithSelection', { selected:d3.selectAll( '.aw-engrtable-columnHeader .selected-cell' ).data() } );
    } );

var columnWidth = function( col, span ) {
    if( span ) {
        var width = 0;
        for( var i = 0; i < span; i++ ) {
            width += columnWidth( col + i );
        }
        return width;
    }
    return network_data.displayWidth[ col ];
};

/**
 * Method to get the unique rows to be added to selection
 * @param {Array} rows the rows selected by user
 */
function getUniqueRows( rows ) {
    var uniqueRows = [];
    var alreadyAddedIndex = [];
    for( var i = 0; i < rows.length; i++ ) {
        var row = rows[ i ];
        if( alreadyAddedIndex.indexOf( row.index ) === -1 ) {
            uniqueRows.push( row );
            alreadyAddedIndex.push( row.index );
        }
    }
    return uniqueRows;
}

var columnStart = function( col ) {
    return network_data.columnStart[ col ];
};

/**
 * Remove all selection indicators.
 */
var clearSelections = function() {
    d3.select( '#clicked_cell' ).attr( 'id', '' ).classed( 'selected-cell', false );
    d3.selectAll( '.selected-cell' ).classed( 'selected-cell', false );
};

/**
 * Select the specified cell
 * @param {*} cellData Data object for the cell or null to clear selection
 */
let setSelection = function( cellData ) {
    if( cellData && cellData.isEditing ) {
        return;
    }
    clearSelections();
    if( !cellData ) {
        d3.selectAll( '.cell' ).classed( 'selected-cell', false );

        eventBus.publish( 'engrTable.updateSelection', { selection: [] } );
        return;
    }
    var row = cellData.pos_y;
    var col = cellData.pos_x;
    cellData = matrix[row][col];
    if( cellData.cellType === 'column' ) {
        d3.selectAll( '.cell' ).classed( 'selected-cell', function( d ) {
            return cellData.span ? d.pos_x >= col && d.pos_x < col + cellData.span : d.pos_x === col;
        } );
    } else if( cellData.cellType === 'row' ) {
        d3.selectAll( '.cell' ).classed( 'selected-cell', function( d ) {
            return d.pos_y === row;
        } );
    } else if( cellData.cellType === 'series' ) {
        d3.selectAll( '.cell' ).classed( 'selected-cell', false );
    } else if( cellData.cellType === 'cell' ) {
        selectCell( row, col );
        return;
    }
    eventBus.publish( 'engrTable.updateSelection', { selection: [ cellData ], dragType: cellData.cellType, minCol: cellData.index, maxCol: cellData.index } );
};

/**
 * Select the specified cell
 * @param {*} selections Data array for the selected headers
 */
let setSelections = function( selections ) {
    clearSelections();
    if( selections && selections.length > 0 ) {
        if ( selections[0].pos_x === 0 && selections[0].pos_y === 0 ) {
            var rows = d3.selectAll( '.aw-engrtable-rowNumber' ).data();
            selections = rows;
        }

        for( var sel = 0; sel < selections.length; sel++ ) {
            var xPos = network_data.hasRowHeaders ? 1 : 0;
            if( network_data.numValues === 1 ) {
                if( !isNaN( selections[sel].index ) ) {
                    selections[sel] = matrix[selections[sel].pos_y][selections[sel].index + xPos];
                } else{
                    selections[0] = matrix[selections[0].pos_y][selections[0].pos_x];
                }
            } else {
                var numVal = network_data.numValues > 1 ?  network_data.numValues : 0;
                if( !isNaN( selections[sel].index ) ) {
                    selections[sel] = matrix[selections[sel].pos_y][selections[sel].index * numVal + xPos  - ( numVal - 1 )];
                } else {
                    selections[0] = matrix[selections[0].pos_y][selections[0].pos_x];
                }
            }
        }
        if( selections && selections.length > 0 && selections[0] ) {
            if ( selections[0].pos_x === 0 && selections[0].pos_y === 0 ) {
                var rows = d3.selectAll( '.aw-engrtable-rowNumber' ).data();
                selections = rows;
                d3.selectAll( '.cell' ).classed( 'selected-cell', true );
            } else if( selections[0].cellType === 'column' ) {
                d3.selectAll( '.cell' ).classed( 'selected-cell', function( d ) {
                    var match = false;
                    selections.forEach( selection => {
                        var span = selection.span ? selection.span : 1;
                        if( d.pos_x >= selection.pos_x && d.pos_x < selection.pos_x + span ) {
                            match = true;
                        }
                    } );
                    return match;
                } );
            } else if( selections[ 0 ].cellType === 'row' ) {
                d3.selectAll( '.cell' ).classed( 'selected-cell', function( d ) {
                    var match = false;
                    selections.forEach( selection => {
                        if( d.pos_y === selection.pos_y ) {
                            match = true;
                        }
                    } );
                    return match;
                } );
            } else if ( selections[0].cellType === 'cell' ) {
                selections.forEach( selection => {
                    getCell( selection.pos_y, selection.pos_x ).classed( 'selected-cell', true );
                } );
            }
            var dragType = selections[ 0 ].cellType;
            var minCol = selections[ 0 ].index;
            var maxCol = selections[ selections.length - 1 ].index;
            eventBus.publish( 'engrTable.updateSelection', { selection: selections, dragType: dragType, minCol: minCol, maxCol: maxCol } );
        }
    }
};

let isSeriesFree = function( index ) {
    var series = network_data.columnSeries[ index ];
    return series.text === '' && series.count === 1 && ( !series.units || series.units === '' || series.units === -1 );
};

let updateSpanCondition = function( dragType, minCol, maxCol, engrTableUpdated ) {
    if ( network_data.undoInProgress ) {
        return;
    }
    var result = false;
    if( network_data.hasColumnSeries && dragType === 'column' ) {
        var minSeries = network_data.columnHeaders[ minCol ].series;
        var maxSeries = network_data.columnHeaders[ maxCol ].series;
        if( minSeries === undefined || maxSeries === undefined || !isSeriesFree( minSeries ) && !isSeriesFree( maxSeries ) ) {
            result = true;
        } else if( isSeriesFree( maxSeries ) && network_data.columnSeries[ minSeries ].start < minCol ) {
            result = true;
        } else if( isSeriesFree( minSeries ) && network_data.columnSeries[ maxSeries ].start + network_data.columnSeries[ maxSeries ].count - 1 !== maxCol ) {
            result = true;
        } else {
            var oldSeries = -1;
            for( var i = minCol; i <= maxCol; i++ ) {
                var series = network_data.columnHeaders[ i ].series;
                if( !isSeriesFree( series ) ) {
                    if( series !== oldSeries && oldSeries !== -1 ) {
                        result = true;
                        break;
                    }
                    oldSeries = series;
                }
            }
        }
    }
    engrTableUpdated.tableModel.hasSeriesSpan = result;
};

/**
 * Handle keystroke from user.
 * @param {*} event keystroke event
 */
let handleKeyboard = function( event ) {
    var cell = d3.select( event.target.parentElement );
    var cellData = cell.data()[ 0 ];
    if( cellData && !cellData.isEditing ) {
        switch ( event.code ) {
            case 'Tab':
                closeEditGMMPopup();
                // Use default tab/backtab behavior, shifts focus to next/previous cell
                break;
            case 'ArrowDown':
            case 'ArrowUp':
            case 'ArrowRight':
            case 'ArrowLeft':
                shiftFocus( cellData, event.code );
                d3.event.preventDefault();
                break;
            case 'Space':
                d3.event.preventDefault();
                editCell( cell );
                break;
            case 'Enter':
                setSelection( cellData );
                break;
            case 'Escape':
                setSelection();
                focusCell( cellData.pos_y, cellData.pos_x );
                break;
            case 'Delete':
                setSelection( cellData );
                clearContents();
                focusCell( cellData.pos_y, cellData.pos_x );
                break;
            default:
                if( event.key.length !== 1 ) {
                    return;
                }
                if( !event.ctrlKey ) {
                    d3.event.preventDefault();
                    editCell( cell, false, event.key );
                }
        }
    }
};

let isTableEditable = function( engrTable ) {
    var param = engrTable.selectedParameter;
    if ( param && param.props.is_modifiable ) {
        return param.props.is_modifiable.dbValues[0] === '1';
    }
    return true;
};

/**
 * Open an editor for the given cell.
 * @param {tableCell} cell The cell to edit
 * @param {boolean} multi True if in edit mode, false if editing single cell
 * @param {string} value Optional, value to place in editor
 */
export let editCell = function( cell, multi, value ) {
    eventBus.publish( 'engrTable.editCell', { cell: cell, multi: multi, value: value } );
};
export let editCellCallBack = function( cell, multi, value, engrTable ) {
    var engrTableUpdated = engrTable;
    var d = cell.data()[ 0 ];
    if( d.isEditing || !d.editable || !isTableEditable( engrTable ) ) {
        return;
    }
    removeInputField();
    var rect = cell.select( 'rect' );
    var editor = cell.append( 'foreignObject' )
        .classed( 'aw-engrtable-cellEditor', true )
        .attr( 'x', rect.attr( 'x' ) )
        .attr( 'y', rect.attr( 'y' ) )
        .attr( 'width', getCellWidth( d ) )
        .attr( 'height', cell_height );
    var divNode = document.createElement( 'div' );
    divNode.setAttribute( 'xmlns', 'http://www.w3.org/1999/xhtml' );
    editor.node().appendChild( divNode );
    var inp = document.createElement( 'INPUT' );
    inp.setAttribute( 'type', 'text' );
    value = value ? value : d.text;
    inp.setAttribute( 'value', value );
    inp.setAttribute( 'size', getCellWidth( d ) / 5.8 - 3 );
    inp.setAttribute( 'id', String( d.pos_y + '-' + d.pos_x ) );
    inp.setAttribute( 'autocomplete', 'off' );
    inp.setAttribute( 'style', 'padding-left: 6; padding-right: 0;' );
    divNode.appendChild( inp );
    if( !multi ) {
        d.isEditing = true;
        inp.focus();
    }
    inp.setSelectionRange( value.length, value.length );
    inp.addEventListener( 'keyup', function( event ) {
        if( event.key === 'Enter' ) {
            // shift focus back to cell which ends edit
            var editedCell = d3.select( '.text' + event.target.getAttribute( 'id' ) );
            var data = editedCell.data()[ 0 ];
            event.preventDefault();
            focusCell( data.pos_y + 1 < network_data.totalRows ? data.pos_y + 1 : data.pos_y, data.pos_x );
        } else if( event.code === 'Escape' ) {
            editedCell = d3.select( '.text' + event.target.getAttribute( 'id' ) );
            var data = editedCell.data()[ 0 ];
            event.target.value = data.text;
            data.isEditing = false;
            removeInputField();
            focusCell( data.pos_y, data.pos_x );
        }
    } );
    inp.addEventListener( 'blur', function( event ) {
        saveCellEdit( event, engrTableUpdated );
    } );
    if( !isAutoSaveEnabled() ) {
        engrTableUpdated.att1IsAutoSaveDisabedInEngrTable = true;
    }
};

/**
 * Function to return check whether auto save flag is on or off
 * @returns {Boolean} the auto save flag
 */
function isAutoSaveEnabled() {
    return appCtxSvc.getCtx( 'autoSave' ) && appCtxSvc.getCtx( 'autoSave.dbValue' ) === true;
}

/**
 * Truncate displayed text in a cell if it overflows the cell. DisplayText is truncated and
 * dots added to end that indicate truncation. Only works for row headers currently;
 * @param {*} data D3 data for the cell
 * @param {*} cell D3 text object
 */
let truncateCellText = function( data, cell ) {
    if( ( data.cellType === 'row' || data.cellType === 'column' ) && data.pos_x === 1 ) {
        var cellInfo = network_data.rowHeaders[ data.index ];
        var txtSize = cell.node().textLength.baseVal.value;
        if( data.w < txtSize + 6 ) {
            var headerText = data.cellType === 'column' ? data.displayText : data.text;
            var length = Math.floor( headerText.length * ( data.w / ( txtSize + 10 ) ) );
            cellInfo.displayText = headerText.slice( 0, length ) + '..';
            cell.attr( 'dx', -4 ).text( cellInfo.displayText );
        }
    }
};

/**
 * Update view and data model after a cell edit
 * @param {*} event Cell editor lose focus event
 */
export let saveCellEdit = function( event, engrTableUpdated ) {
    var editedCell = d3.select( '.text' + event.target.getAttribute( 'id' ) );
    var data = editedCell.data()[ 0 ];
    if( data.text !== event.target.value ) {
        var editOperation = createEditOperation( 'editCells', [ data ], [ data ] );
        data.text = event.target.value;
        var cell;
        if( data.cellType === 'row' ) {
            cell = network_data.rowHeaders[ data.index ];
            cell.displayText = data.text;
            cell.text = data.text;
            data.displayText = data.text;
        } else if( data.cellType === 'column' || data.cellType === 'table' ) {
            cell = network_data.columnHeaders[ data.index ];
            cell.displayText = data.text;
            cell.text = data.text;
            data.displayText = data.text;
        } else if( data.cellType === 'series' ) {
            cell = network_data.columnSeries[ data.index ];
            cell.text = data.text;
            cell.displayText = data.text;
            data.displayText = data.text;
        } else {
            cell = network_data.cells[ data.source ][ data.target ];
            cell[ data.index ] = data.text;
        }
        editedCell.text( data.text );
        truncateCellText( data, editedCell );
        eventBus.publish( 'engrTable.cellChanged', editOperation );

        if( network_data.editMode ) {
            var node = editedCell.node();
            d3.select( node.parentNode ).select( '.cell' ).classed( 'dirty', true );
            data.isDirty = true;
            setDirty( cell, data, true );
        }
        engrTableUpdated.network_data = network_data;
        engrTableUpdated.tableModel.tableData = network_data;
        if( !network_data.editMode && isAutoSaveEnabled() ) {
            saveEdit( data, engrTableUpdated );
        } else if( engrTableUpdated.chartSeriesData ) {
            att1ChartService.updateChartData( [ data ], engrTableUpdated, true );
        }
        addUndo( editOperation, engrTableUpdated );
    }
    data.isEditing = false;
    removeInputField();
};

let setDirty = function( cell, data, dirty ) {
    if ( data.cellType === 'cell' ) {
        if ( cell.isDirty === undefined ) {
            cell.isDirty = [];
        }
        cell.isDirty[ data.index ] = dirty;
    } else {
        cell.isDirty = dirty;
    }
};

let setRangeDirty = function( tableData, cell ) {
    if ( !tableData.editMode ) {
        return;
    }
    cell.isDirty = [];
    tableData.subHeaders.forEach( subHeader => {
        cell.isDirty[ subHeader ] = true;
    } );
};

let isDirty = function( cell, index ) {
    if ( cell.isDirty && index ) {
        return cell.isDirty[ index ];
    }
    return cell.isDirty;
};

/**
 * Add an operation to the undo stack.
 * @param {*} operation The edit operation
 */
let addUndo = function( operation, engrTableUpdated, suppressUpdate ) {
    const maxUndoLevels = 25;
    undoStack.push( operation );
    if ( undoStack.length > maxUndoLevels ) {
        undoStack.splice( 0, 1 );
    }
    var tableName = engrTableUpdated.tableModel.tableName;

    if ( !suppressUpdate ) {
        eventBus.publish( 'engrTable.updateUndo', { tableName: tableName, value: true } );
    }
    engrTableUpdated[ tableName ].undo = true;
};

export let updateUndo = function( engrTable, event ) {
    var engrTableUpdated = engrTable;
    if ( event.value !== undefined ) {
        engrTableUpdated[ event.tableName ].undo = event.value;
    }
    return { engrTable: engrTableUpdated };
};

/**
 * Handle selection of a cell.
 * @param {object} cell The selected cell element
 * @param {object} data Link data for cell
 */
export let handleCellSelection = function( cell, isCrossProbing ) {
    var data = cell.data()[ 0 ];
    var selectionEventData = {};
    var clear = cell.attr( 'id' ) === 'clicked_cell';
    clearSelections();
    if( !clear || isCrossProbing ) {
        selectionEventData.colUid = [ data.pos_x ];
        selectionEventData.rowUid = [ data.pos_y ];
        cell.attr( 'id', 'clicked_cell' ).classed( 'selected-cell', true );
        eventBus.publish( 'engrTable.updateSelection', { selection: [ data ], isCrossProbing:isCrossProbing } );
    } else {
        selectionEventData.colUid = [];
        selectionEventData.rowUid = [];
        eventBus.publish( 'engrTable.updateSelection', { selection: [] } );
    }
};

/**
 * Return data for the selected cell
 * @returns {cellData} Data for the currently selected cell
 */
export let getSelection = function( engrTable ) {
    if( engrTable.tableModel && engrTable.tableModel.tableName ) {
        var tableName = engrTable.tableModel.tableName;
        if( engrTable[ tableName ] ) {
            var selection = engrTable[ tableName ].selectedCell;
            if( !selection || selection.length === 0 ) {
                return null;
            }
            return selection[ 0 ];
        }
    }
};

/**
 * Return data for the selected cells. This only includes the header cell for row or column selection.
 * @returns {cellData[]} Data for the currently selected cell
 */
export let getSelections = function( engrTable ) {
    if ( engrTable && engrTable.tableModel ) {
        var tableName = engrTable.tableModel.tableName;
        return engrTable[ tableName ].selectedCell;
    }
    return [];
};

export let updateSelection = function( engrTable, cells, dragType, minCol, maxCol ) {
    var engrTableUpdated = engrTable;
    var tableName = engrTableUpdated.tableModel.tableName;
    engrTableUpdated[tableName].selectedCell = cells;
    engrTableUpdated.tableModel.selectedCell = cells;
    let selectedParameter = engrTable?.selectedParameter;
    var canEnableColumnFillCommand = isEnableColumnFillCommand( cells, tableName, selectedParameter );
    engrTableUpdated.isEnableColumnFillCommand = canEnableColumnFillCommand;
    if( dragType && minCol && maxCol ) {
        updateSpanCondition( dragType, minCol, maxCol, engrTableUpdated );
    }
    return { engrTable: engrTableUpdated };
};

/**
 * Method to decide wheter Copy Column Fill command should be enabled or not
 * @param {*} cells ther selected cells
 * @param {*} tableName the active engineering table name
 * @returns {Boolean} flag represents wheter Copy Column Fill command should be enabled or not
 */
function isEnableColumnFillCommand( cells, tableName, selectedParameter ) {
    var canEnableColumnFillCommand = true;

    // check if the parameter is modifiable or not
    if( selectedParameter &&  selectedParameter?.props?.is_modifiable?.dbValues['0'] === '0' ) {
        //parameter is not modifiable
        return false;
    }

    if ( cells !== undefined && cells.length === 1 ) {
        if ( cells[0].cellType !== 'cell' ) {
            canEnableColumnFillCommand = false;
        } else {
            var isGMMCellSelected = cells[0].index === 'Goal' || cells[0].index === 'Min' || cells[0].index === 'Max';
            if ( tableName === 'valueTable' && isGMMCellSelected ) {
                canEnableColumnFillCommand = false;
            }
        }
    } else if( cells !== undefined && cells.length > 0 ) {
        var lastSelectedCellPosX = cells[0].pos_x;
        var lastSelectedCellPosY = cells[0].pos_y;
        for ( var i = 1; i < cells.length; i++ ) {
            var selectedCellPosX = cells[i].pos_x;
            var selectedCellPosY = cells[i].pos_y;
            if ( cells[i].cellType === 'cell' && lastSelectedCellPosX + 1 === selectedCellPosX && lastSelectedCellPosY === selectedCellPosY ) {
                if ( tableName === 'valueTable' && ( cells[i].index === 'Goal' || cells[i].index === 'Min' || cells[i].index === 'Max' ) ) {
                    canEnableColumnFillCommand = false;
                    break;
                }
                canEnableColumnFillCommand = true;
            } else {
                canEnableColumnFillCommand = false;
                break;
            }
            lastSelectedCellPosX = selectedCellPosX;
            lastSelectedCellPosY = selectedCellPosY;
        }
    }
    return canEnableColumnFillCommand;
}

let clearSelection = function( engrTableUpdated ) {
    if( engrTableUpdated && engrTableUpdated.goalTable ) {
        engrTableUpdated.goalTable.selectedCell = undefined;
    }
    if( engrTableUpdated && engrTableUpdated.valueTable ) {
        engrTableUpdated.valueTable.selectedCell = undefined;
    }
};

/**
 * Return data for the selected cells. This includes all cells shown as selected.
 * @returns {cellData[]} Data for the currently selected cells
 */
export let getSelectedCells = function( engrTable ) {
    var selections = getSelections( engrTable );
    var selectedCells = [];
    if ( selections && selections.length > 0 ) {
        var cellData = selections[0];
        if ( cellData.cellType === 'column' ) {
            for ( var i = cellData.pos_y; i < matrix.length; i++ ) {
                selections.forEach( selected => {
                    var span = selected.span ? selected.span : 1;
                    for ( var j = selected.pos_x; j < selected.pos_x + span; j++ ) {
                        selectedCells.push( matrix[i][j] );
                    }
                } );
            }
            return selectedCells;
        } else if ( cellData.cellType === 'row' ) {
            selections.forEach( selected => {
                for ( var i = selected.pos_x; i < matrix[selected.pos_y].length; i++ ) {
                    selectedCells.push( matrix[selected.pos_y][i] );
                }
            } );
            return selectedCells;
        }
    }
    var selection = d3.selectAll( '.selected-cell' );
    if( selection.empty() ) {
        return null;
    }
    return selection.data();
};

/**
 * Get cell at specified table location
 * @param {integer} row The row
 * @param {integer} col The column
 * @returns {tableCell} The d3 cell
 */
export let getCell = function( row, col ) {
    var cellTag = '.cell' + row + '-' + col;
    return d3.select( cellTag );
};

/**
 * Select the cell at the specified table location.
 * @param {integer} row The row
 * @param {integer} col The column
 */
export let selectCell = function( row, col, isDataSelection, isCrossProbing, engrTable ) {
    if( isCrossProbing ) {
        scrollToAndSelectCell( row, col, isDataSelection, engrTable, isCrossProbing );
        return;
    }
    var cell = getCell( row, col );
    if( !cell.empty() ) {
        handleCellSelection( cell, isCrossProbing );
        cell.node().focus();
    }
};

/**
 * Method to handle cross probing from chart to table. If cell is not visible in current rendered data then it will scroll to required position
 * @param {*} row the row number of the cell
 * @param {*} col the column number of the cell
 * @param {*} isDataSelection the flag to check whether to select data
 * @param {*} engrTable the engineeting table context
 * @param {*} isCrossProbing falg to check if cross probing needs to be done
 */
function scrollToAndSelectCell( row, col, isDataSelection, engrTable, isCrossProbing ) {
    if ( isDataSelection ) {
        var headerColCount = engrTable.tableModel.tableData.headerColCount;
        var headerRowCount = engrTable.tableModel.tableData.headerRowCount;
        row += headerRowCount;
        col += headerColCount;
    }
    var cell = getCell( row, col );
    if ( cell.empty()  || row <= headerRowCount || col <= headerColCount ) {
        var tableName = engrTable.tableModel.tableName;
        var tableElement = document.getElementById( tableName );
        var columnHeaders = engrTable.tableModel.tableData.columnHeaders;
        var columnWidth = 0;
        for( var i = 0; i < col - headerColCount; i++ ) {
            var column = columnHeaders[i];
            columnWidth += column.width;
        }
        tableElement.scroll( columnWidth, cell_height * ( row - headerRowCount ) );
        var eventSubscribe = eventBus.subscribe( 'Att1EngrTable.ScrollCompleted', function() {
            var cell = getCell( row, col, isDataSelection, engrTable );
            if( !cell.empty() ) {
                handleCellSelection( cell, isCrossProbing );
                cell.node().focus();
            }
            eventBus.unsubscribe( eventSubscribe );
        } );
    }
    handleCellSelection( cell, isCrossProbing );
    cell.node().focus();
}

/**
 * Check if a cell is selected
 * @param {*} cell The cell
 * @return {boolean} True if cell is currently selected
 */
let isSelected = function( cell ) {
    return getCell( cell.pos_y, cell.pos_x ).classed( 'selected-cell' );
};

/**
 * Select the cell at the specified table location.
 * @param {integer} row The row
 * @param {integer} col The column
 */
export let focusCell = function( row, col ) {
    var cell = getCell( row, col );
    if( !cell.empty() ) {
        cell.node().focus();
    }
    return cell;
};

/**
 * Select the cell at the specified table location.
 * @param {*} cellData The current cell
 * @param {*} direction Direction to move
 */
export let shiftFocus = function( cellData, direction ) {
    var row = cellData.pos_y;
    var col = cellData.pos_x;
    switch ( direction ) {
        case 'ArrowDown':
            row++;
            break;
        case 'ArrowUp':
            row--;
            break;
        case 'ArrowRight':
            col += cellData.span ? cellData.span : 1;
            break;
        case 'ArrowLeft':
            col--;
            break;
    }
    // prevent going outside of table
    if ( col >= network_data.totalColumns || row >= network_data.totalRows || col < 0 || row < 0 ) {
        focusCell( cellData.pos_y, cellData.pos_x );
        return;
    }
    var cell = focusCell( row, col );
    if ( cell.empty() ) {
        // missing cell could be due to span in column headings
        var spanCol = 0;
        if( row < network_data.headerRowCount && row >= 0 && col <= network_data.totalColumns ) {
            for( var i = 0; i < col; i++ ) {
                if( matrix[ row ][ i ].cellType !== '' ) {
                    spanCol = i;
                }
            }
            cell = focusCell( row, spanCol );
        }
    } else {
        // record cell location so it can be restored after auto scroll
        network_data.focus = { row: row, col: col };
    }
};

/**
 * Handle modified table data. If in direct edit mode save to database, in edit mode mark table dirty.
 * Refresh client to show updated table.
 * @param {*} tableData The updated table data
 */
let saveChanges = function( tableData, engrTableUpdated ) {
    var eventData = {
        tableData: tableData
    };

    if( tableData.editMode ) {
        tableData.table.isDirty = true;
    } else {
        network_data = tableData;
        saveEditEngrTable( engrTableUpdated, true );
    }
    refreshTable( eventData, engrTableUpdated );
    var element = document.getElementById( tableData.tableName );
    if ( element.scrollTop > 0 || element.scrollLeft > 0 ) {
        tableData.scroll = { top: element.scrollTop, left: element.scrollLeft };
    }
};

/**
 * Insert a column for row headers.
 * @param {*} tableData The table
 */
export let insertRowHeaders = function( engrTable ) {
    var selection = getSelection( engrTable );

    let engrTableUpdated = engrTable;
    engrTableUpdated.network_data = network_data;
    var tableData = engrTableUpdated.network_data;
    tableData.hasRowHeaders = true;
    saveChanges( tableData, engrTableUpdated );
    if ( !tableData.undoInProgress ) {
        addUndo( createEditOperation( 'insertRowHeaders', [ selection ], [] ), engrTable );
    }
};

/**
 * Insert a column next to the specified column.
 * @param {*} right If true insert right of selected column, if false left.
 * @param {*} engrTable the table data
 * @param {*} useSelections if present use this as the selected columns
 */
export let insertColumn = function( right, engrTable, useSelections ) {
    var selections = useSelections ? useSelections : getSelections( engrTable );
    CloseAllPopups();
    let engrTableUpdated = engrTable;
    engrTableUpdated.network_data = network_data;
    var tableData = engrTableUpdated.network_data;

    if( !selections ) {
        return;
    }

    selections.forEach( selection => {
        var col = right ? selection.index : selection.index - 1;
        var cols = tableData.columnHeaders;
        var newHeader = {
            text: '',
            displayText: '',
            units: '',
            isDirty: tableData.editMode,
            width: cell_width
        };
        var series = cols[col].series;
        if ( tableData.hasColumnSeries ) {
            if ( col + 1 < cols.length && series === cols[col + 1].series ) {
                newHeader.series = series;
                tableData.columnSeries[series].count++;
            } else {
                series = col === 0 ? 0 : series + 1;
                tableData.columnSeries.splice( series, 0, {
                    text: '',
                    count: 1,
                    start: col + 1
                } );
                for ( i = col + 1; i < cols.length; i++ ) {
                    cols[i].series++;
                }
            }
            for ( i = series + 1; i < tableData.columnSeries.length; i++ ) {
                tableData.columnSeries[i].start++;
            }
            newHeader.series = series;
        }
        cols.splice( col + 1, 0, newHeader );

        var cells = tableData.cells;
        for ( var i = 0; i < tableData.rowHeaders.length; i++ ) {
            cells[i].splice( col, 0, {
                cellType: 'cell',
                source: i,
                target: col
            } );
            setRangeDirty( tableData, cells[ i ][ col ] );
            if ( noEmptyCells ) {
                for ( var j = 0; j < tableData.subHeaders.length; j++ ) {
                    cells[i][col][tableData.subHeaders[j]] = '';
                }
            }
        }

        for ( i = 0; i < tableData.rowHeaders.length; i++ ) {
            for ( j = col + 1; j < cols.length - 1; j++ ) {
                cells[i][j].target++;
            }
        }
    } );

    if ( !tableData.undoInProgress ) {
        saveChanges( tableData, engrTableUpdated );
        var newColData = getCell( selections[0].pos_y, selections[0].pos_x + ( right ? tableData.numValues : 0 ) ).data()[0];
        addUndo( createEditOperation( 'insertColumn', selections, [ newColData ] ), engrTable );
        setSelection( selections[0] );
    }
};

/*
 * Toggle edit mode on and off. A cell editor is added to each cell in edit mode.
 */
export let startEditInEngrTable = function( engrTable ) {
    if( engrTable.value ) {
        var engrTableUpdated = { ...engrTable.value };
    } else {
        var isCalledFromOwnViewModel = true;
        engrTableUpdated = engrTable;
    }
    var tableName = engrTableUpdated.tableModel.tableName;
    engrTableUpdated[ tableName ].isDirty = true;
    engrTableUpdated[ tableName ].isEditing = true;
    engrTableUpdated[ tableName ].undo = false;
    engrTableUpdated[ tableName ].tableName = createJson( tableName === 'valueTable' );
    engrTableUpdated.network_data = engrTableUpdated.tableModel.tableData;
    engrTableUpdated.network_data.editMode = true;
    network_data.editMode = true;

    d3.selectAll( '.aw-engrtable-cell .cell' )
        .style( 'stroke-width', function( d ) {
            return d.editable ? 3 : 0.7;
        } );
    if ( !isCalledFromOwnViewModel ) {
        engrTable.update( engrTableUpdated );
    }
};

/**
 * Insert a row next to the specified row.
 * @param {*} above If true insert above selected row, if false below.
 * @param {*} engrTable the table
 * @param {*} multi if true it is multi row insert
 * @param {*} useSelections if present use this as the selected rows
 */
export let insertRow = function( above, engrTable, multi, useSelections ) {
    CloseAllPopups();
    let engrTableUpdated = engrTable;
    engrTableUpdated.network_data = network_data;
    var tableData = engrTableUpdated.network_data;
    var selections = useSelections ? useSelections : getSelections( engrTableUpdated );
    if( !selections ) {
        return;
    }
    if ( !useSelections ) {
        selections = selections.slice( 0, 1 );
    }
    selections.forEach( selection => {
        if ( selection.cellType !== 'row' ) {
            return;
        }
        var rowPos = above ? selection.pos_y : selection.pos_y + 1;
        var row = rowPos - tableData.headerRowCount;
        tableData.rowHeaders.splice( row, 0, {
            text: '',
            displayText: '',
            isDirty: tableData.editMode
        } );

        var cells = tableData.cells;
        cells.splice( row, 0, [] );
        for( var i = 0; i < tableData.columnHeaders.length - 1; i++ ) {
            cells[ row ][ i ] = {
                cellType: 'cell',
                source: row,
                target: i
            };
            setRangeDirty( tableData, cells[ row ][ i ] );
            if ( noEmptyCells ) {
                for ( var j = 0; j < tableData.subHeaders.length; j++ ) {
                    cells[row][i][tableData.subHeaders[j]] = '';
                }
            }
        }
        // adjust indexes in rows below inserted row
        for( var j = row + 1; j < cells.length; j++ ) {
            for( var k = 0; k < tableData.columnHeaders.length - 1; k++ ) {
                cells[ j ][ k ].source++;
            }
        }
    } );
    if ( !tableData.undoInProgress ) {
        saveChanges( tableData, engrTableUpdated );
        var newRowData = getCell( selections[0].pos_y + ( above ? 0 : 1 ), selections[0].pos_x ).data()[0];
        addUndo(  createEditOperation( 'insertRow', selections, [ newRowData ] ), engrTable );
        setSelections( selections );
    }
};

/**
 * Insert a column header series above the selected columns.
 * @param {*} tableData the table
 */
export let insertColumnSeries = function( engrTable ) {
    CloseAllPopups();

    let engrTableUpdated = engrTable;
    engrTableUpdated.network_data = network_data;
    var tableData = engrTableUpdated.network_data;
    var selection = getSelections( engrTableUpdated );
    if( !selection || selection.length === 0 || selection[ 0 ].index === 0 ) {
        return;
    }

    // if there are no series add series for each collumn
    if( !tableData.hasColumnSeries ) {
        tableData.columnSeries = [];
        for( i = 1; i < tableData.columnHeaders.length; i++ ) {
            tableData.columnSeries.push( {
                text: '',
                count: 1,
                start: i,
                displayText: '',
                units: ''
            } );
            tableData.columnHeaders[ i ].series = i - 1;
        }
        tableData.hasColumnSeries = true;
    } else {
        var realSeries = -1;
        var isFree = false;
        for( var i = 0; i < selection.length; i++ ) {
            if( !tableData.columnSeries[ selection[ i ].series ].free ) {
                if( realSeries >= 0 && realSeries !== selection[ i ].series ) {
                    return;
                }
                realSeries = selection[ i ].series;
            } else {
                isFree = true;
            }
        }
        if( !isFree ) {
            return;
        }
    }

    // get series span for selection
    var first = selection[ 0 ].index;
    var last = first + selection.length - 1;
    var firstSeries = -1;
    var lastSeries;
    var existingSeries = null;
    for( i = 0; i < tableData.columnSeries.length; i++ ) {
        var series = tableData.columnSeries[ i ];
        if( series.start + series.count - 1 < first || series.start > last ) {
            // series not in selection
        } else {
            if( firstSeries === -1 ) {
                firstSeries = i;
            }
            if( series.text !== '' || series.units && series.units !== '' || series.count > 1 ) {
                existingSeries = series;
            }
            lastSeries = i;
        }
    }
    if( existingSeries ) {
        existingSeries.start = first;
        existingSeries.count = last - first + 1;
        tableData.columnSeries.splice( firstSeries, lastSeries - firstSeries + 1, existingSeries );
    } else {
        series = {
            text: '',
            displayText: '',
            count: last - first + 1,
            start: first
        };
        tableData.columnSeries.splice( firstSeries, lastSeries - firstSeries + 1, series );
    }
    for( i = first; i <= last; i++ ) {
        tableData.columnHeaders[ i ].series = firstSeries;
    }
    for( i = last + 1; i < tableData.columnHeaders.length; i++ ) {
        tableData.columnHeaders[ i ].series -= lastSeries - firstSeries;
    }
    saveChanges( tableData, engrTableUpdated );
    setSelections( selection );
    resetUndo( engrTableUpdated );
};


let cloneCells = function( cells ) {
    var newCells = [];
    if ( cells ) {
        cells.forEach( cell => {
            newCells.push( Object.assign( {}, cell ) );
        } );
    }
    return newCells;
};

let createEditOperation = function( operation, selection, cells ) {
    return { operation: operation, selections: cloneCells( selection ), cells: cloneCells( cells ) };
};

/**
 * Delete the selected row or column.
 * @param {*} tableData the table
 */
export let deleteRowOrColumn = function( engrTable ) {
    CloseAllPopups();
    let engrTableUpdated = engrTable;
    engrTableUpdated.network_data = network_data;
    var tableData = engrTableUpdated.network_data;

    var selection = getSelections( engrTableUpdated );
    var  op = createEditOperation( '', selection, getSelectedCells( engrTable ) );
    if( selection && selection.length > 0 ) {
        if( selection[ 0 ].cellType === 'row' ) {
            op.modelCells = getModelRows( selection, tableData );
            deleteRow( selection, tableData, engrTableUpdated );
            op.operation = 'deleteRow';
        } else if( selection[ 0 ].cellType === 'column' ) {
            if( selection[ 0 ].index === 0 ) {
                deleteRowHeaders( tableData, engrTableUpdated );
                op.operation = 'deleteRowHeaders';
            } else if ( selection[0].editable ) {
                op.modelCells = getModelColumns( selection, tableData );
                deleteColumn( selection, tableData, engrTableUpdated );
                op.operation = 'deleteColumn';
            }
        } else if( selection[ 0 ].cellType === 'series' ) {
            deleteSeries( selection[ 0 ], tableData, engrTableUpdated );
        } else if( selection[ 0 ].cellType === 'cell' ) {
            clearContents( engrTable );
            op.operation = 'editCells';
        }
        if ( op.operation ) {
            addUndo( op, engrTable );
        }
    }
};

function getModelRows( selections, tableData ) {
    var modelCells = [];
    selections.forEach( selection => {
        modelCells = modelCells.concat( tableData.cells[ selection.index ] );
    } );
    return modelCells;
}

function getModelColumns( selections, tableData ) {
    var modelCells = [];
    selections.forEach( selection => {
        var index = selection.index - 1;
        tableData.cells.forEach( row => {
            modelCells.push( row[index] );
        } );
    } );
    return modelCells;
}

/**
 * Delete the specified row.
 * @param {*} rowData Selected row header cell data.
 * @param {*} tableData the table
 */
export let deleteRow = function( rowData, tableData, engrTableUpdated ) {
    for( var k = rowData.length - 1; k >= 0; k-- ) {
        var row = rowData[ k ].pos_y;
        row -= tableData.headerRowCount;
        var rows = tableData.rowHeaders;
        if( rows.length === 1 ) {
            return;
        }
        rows.splice( row, 1 );
        var cells = tableData.cells;
        cells.splice( row, 1 );
        for( var i = row; i < cells.length; i++ ) {
            for( var j = 0; j < tableData.columnHeaders.length - 1; j++ ) {
                cells[ i ][ j ].source--;
            }
        }
    }
    saveChanges( tableData, engrTableUpdated );
    setSelection( getCell( rowData[ 0 ].pos_y, rowData[ 0 ].pos_x ).data()[ 0 ] );
};

/**
 * Delete the specified column.
 * @param {*} colData Selected column header cell data.
 * @param {*} tableData the table
 */
export let deleteColumn = function( colData, tableData, engrTableUpdated ) {
    for( var k = colData.length - 1; k >= 0; k-- ) {
        var col = colData[ k ].index - 1;
        var cols = tableData.columnHeaders;
        var series = cols[ col + 1 ].series;
        if( series >= 0 ) {
            if( tableData.columnSeries[ series ].count > 1 ) {
                tableData.columnSeries[ series ].count--;
            } else {
                tableData.columnSeries.splice( series, 1 );
                for( var i = col + 1; i < cols.length; i++ ) {
                    cols[ i ].series--;
                }
            }
        }
        cols.splice( col + 1, 1 );

        var cells = tableData.cells;
        var j = 0;
        for( var i = 0; i < tableData.rowHeaders.length; i++ ) {
            var row = tableData.cells[ i ];
            row.splice( col, 1 );
            for( var j = col; j < row.length; j++ ) {
                cells[ i ][ j ].target--;
            }
        }
        for( i = 0; i < tableData.columnSeries.length; i++ ) {
            if( tableData.columnSeries[ i ].start > col + 1 ) {
                tableData.columnSeries[ i ].start--;
            }
        }
    }
    saveChanges( tableData, engrTableUpdated );
    setSelection( getCell( colData[ 0 ].pos_y, colData[ 0 ].pos_x ).data()[ 0 ] );
};

/**
 * Remove the column containing row headers.
 * @param {*} tableData the table data
 */
let deleteRowHeaders = function( tableData, engrTableUpdated ) {
    tableData.hasRowHeaders = false;
    tableData.columnHeaders[ 0 ].text = '';
    tableData.columnHeaders[ 0 ].displayText = '';
    tableData.columnHeaders[ 0 ].units = '';
    for( var i = 0; i < tableData.rowHeaders.length; i++ ) {
        tableData.rowHeaders[ i ].text = '';
    }
    saveChanges( tableData, engrTableUpdated );
};

/**
 * Delete the specified series.
 * @param {*} seriesData Selected series header cell data.
 * @param {*} tableData the table
 */
export let deleteSeries = function( seriesData, tableData, engrTableUpdated ) {
    var index = seriesData.index;
    var count = tableData.columnSeries[ index ].count;
    var start = tableData.columnSeries[ index ].start;
    tableData.columnSeries.splice( index, 1 );
    for( var i = 0; i < count; i++ ) {
        tableData.columnSeries.splice( index + i, 0, {
            text: '',
            count: 1,
            start: start + i,
            units: ''
        } );
        tableData.columnHeaders[ start + i ].series = index + i;
    }
    for( i = start + count; i < tableData.columnHeaders.length; i++ ) {
        tableData.columnHeaders[ i ].series += count - 1;
    }

    var emptySeries = true;
    for( i = 0; i < tableData.columnSeries.length; i++ ) {
        var series = tableData.columnSeries[ i ];
        if( series.text !== '' || series.units !== '' || series.count !== 1 ) {
            emptySeries = false;
        }
    }
    if( emptySeries ) {
        tableData.hasColumnSeries = false;
        tableData.columnSeries = [];
        for( i = 0; i < tableData.columnHeaders.length; i++ ) {
            tableData.columnHeaders[ i ].series = undefined;
        }
    }
    saveChanges( tableData, engrTableUpdated );
    resetUndo( engrTableUpdated );
};

/**
 * Copy the selected cells to the clipboard.
 */
export let copyCells = function( engrTable ) {
    CloseAllPopups();
    let engrTableUpdated = engrTable;
    d3.selectAll( '.aw-engrtable-cell .copying' ).classed( 'copying', false );
    d3.selectAll( '.aw-engrtable-cell .selected-cell' ).classed( 'copying', true );
    var selection = getSelectedCells( engrTable );

    _.set( appCtxSvc, 'ctx.' + network_data.tableName + '.copiedCells', selection );

    // get the table data
    var oldRow = -1;
    var cellArray = [];
    var j = 0;
    var rowNum = -1;

    if ( selection[0].pos_x === 0 && selection[0].pos_y === 0 ) {
        for ( var i = network_data.headerRowCount; i < matrix.length; i++ ) {
            for ( var j = network_data.headerColCount; j < matrix[0].length; j++ ) {
                cellArray[i - network_data.headerRowCount][j - network_data.headerColCount] = matrix[i][j].text;
            }
        }
    } else {
        // convert selection list to table based on row
        for( var i = 0; i < selection.length; i++ ) {
            if ( selection[i].cellType !== 'cell' ) {
                continue;
            }
            if( selection[ i ].pos_y !== oldRow ) {
                j = 0;
                rowNum++;
                oldRow = selection[ i ].pos_y;
                cellArray[ rowNum ] = [];
            }
            cellArray[ rowNum ][ j ] = selection[ i ].text;
            j++;
        }
    }

    // create view model object with selected cell data and put on clipboard
    var vmObject = tcViewModelObjectSvc.createViewModelObjectById( 'AAAAAAAAAAAAAA' );
    vmObject.engrTableCells = cellArray;
    clipboardService.instance.setContents( [ vmObject ] );
    setSelection();
};

/**
 * Cut the selected cells to the clipboard.
 */
export let cutCells = function( engrTable ) {
    CloseAllPopups();
    let engrTableUpdated = engrTable;
    engrTableUpdated.network_data = network_data;
    var tableData = engrTableUpdated.network_data;
    this.copyCells( engrTable );
    var copyCells = d3.selectAll( '.aw-engrtable-cell .copying' ).data();
    var cells = tableData.cells;
    var undoCells = [];

    for( var i = 0; i < copyCells.length; i++ ) {
        var cell = copyCells[ i ];
        undoCells.push( Object.assign( {}, cell ) );
        cells[ cell.source ][ cell.target ][ cell.index ] = '';
        copyCells[i].text = '';
    }
    saveChanges( tableData, engrTableUpdated );
    for( var i = 0; i < copyCells.length; i++ ) {
        var c = getCell( copyCells[ i ].pos_y, copyCells[ i ].pos_x );
        c.classed( 'copying', true );
    }
    addUndo( createEditOperation( 'editCells', undoCells, undoCells ), engrTable );
    Att1ChartService.updateChartData( copyCells, engrTableUpdated, true );
};

/**
 * Paste cells from AW clipboard into the table at the selected cell.
 */
export let pasteCells = function( engrTable ) {
    CloseAllPopups();
    let engrTableUpdated = engrTable;
    var tableData = network_data;
    // get copied cell data vmo on the clipboard
    var clipboard = clipboardService.instance.getContents();
    var cells = clipboard[ 0 ].engrTableCells;
    var undoCells = [];

    // Update table starting at selected cell
    var selected = getSelectedCells( engrTable );
    var selections = getSelections();

    var startRow = selected[0].pos_y < network_data.headerRowCount ? network_data.headerRowCount : selected[0].pos_y;
    var startCol = selected[0].pos_x < network_data.headerColCount ? network_data.headerColCount : selected[0].pos_x;
    var range = false;
    if( selected.length > 1 ) {
        range = true;
        var endCell = selected[ selected.length - 1 ];
        var maxRow = endCell.pos_y - startRow;
        var maxCol = endCell.pos_x - startCol;
        var copyRows = cells.length;
        var copyCols = cells[ 0 ].length;
    }
    if( !range ) {
        for( var i = 0; i < cells.length; i++ ) {
            if( startRow + i >= matrix.length ) {
                break; // stop if pasted data would overflow
            }
            var cols = cells[ i ];
            for( var j = 0; j < cols.length; j++ ) {
                if( startCol + j >= matrix[ startRow + i ].length ) {
                    break; // stop if pasted data would overflow
                }
                var cell = matrix[ startRow + i ][ startCol + j ];
                undoCells.push( Object.assign( {}, cell ) );
                cell.text = cols[ j ];
                var text = '.text' + ( startRow + i ) + '-' + ( startCol + j );
                var textElement = d3.select( text );
                textElement.text( cols[j] );
                if ( cell.cellType === 'cell' ) {
                    tableData.cells[cell.source][cell.target][cell.index] = cols[j];
                    setDirty( tableData.cells[ cell.source ][ cell.target ], cell, tableData.editMode );
                }
            }
        }
    } else {
        for( var i = 0; i <= maxRow; i++ ) {
            var rowIdx = i % copyRows;
            var cols = cells[ rowIdx ];
            if ( startRow + i >= matrix.length ) {
                break;
            }
            for( var j = 0; j <= maxCol; j++ ) {
                if ( startCol + j >= matrix[startRow + i].length ) {
                    break;
                }
                var colIdx = j % copyCols;
                var cell = matrix[ startRow + i ][ startCol + j ];
                if ( cell.subHeader ) {
                    startRow++;
                    maxRow--;
                    cell = matrix[startRow + i][startCol + j];
                }
                undoCells.push( Object.assign( {}, cell ) );
                cell.text = cols[ colIdx ];
                var text = '.text' + ( startRow + i ) + '-' + ( startCol + j );
                d3.select( text ).text( cols[ j ] );
                if ( cell.cellType === 'cell' ) {
                    tableData.cells[ cell.source ][ cell.target ][ cell.index ] = cols[ colIdx ];
                    setDirty( tableData.cells[ cell.source ][ cell.target ], cell, tableData.editMode );
                }
            }
        }
    }
    _.set( appCtxSvc, 'ctx.' + network_data.tableName + '.copiedCells', [] );
    saveChanges( tableData, engrTableUpdated );
    Att1ChartService.updateChartData( selected, engrTableUpdated, true );
    addUndo( createEditOperation( 'editCells', undoCells, undoCells ), engrTable );
    setSelections( selections );
    clipboardService.instance.setContents();
};

/**
 * Get the table data.
 * @return {*} Table data
 */
let getNetworkData = function() {
    return network_data;
};

/**
 * To display the popup for GMMM
 * @param {*} d
 */
export let showPopup = function( d, engrTable ) {
    // launch popup to edit goal min and max

    var isGoalTableDirty = engrTable.goalTable ? engrTable.goalTable.isDirty : false;
    var isvValueTableDirty = engrTable.valueTable ? engrTable.valueTable.isDirty : false;
    var tableData = getNetworkData();
    if( tableData.numValues === 1 && d.cellType === 'cell' && !d.isEditing && !isGoalTableDirty && !isvValueTableDirty ) {
        closeEditGMMPopup();
        if( !_loadingTooltip ) {
            var cellData = Object.assign( {}, d );
            cellData.Goal = tableData.cells[ d.source ][ d.target ].Goal;
            cellData.Max = tableData.cells[ d.source ][ d.target ].Max;
            cellData.Min = tableData.cells[ d.source ][ d.target ].Min;
            _showId = setTimeout( function() { showEditGMMPopup( cellData, engrTable ); }, 700 );
        }
    }
};

/**
 * function to launch edit GMM popup
 * @param {*} cellInfo
 */
let showEditGMMPopup = function( cellInfo, engrTable ) {
    if( !isDoubleClick ) {
        var selection = getSelection( engrTable );
        if( selection && cellInfo.pos_x === selection.pos_x && cellInfo.pos_y === selection.pos_y && engrTable.tableModel && !_popupRefCtx ) {
            var readOnly = engrTable.tableModel.readOnly;

            if( readOnly === true || selection && ( selection.cellType === 'column' || selection.cellType === 'row' ) ) {
                return;
            }

            _loadingTooltip = true;
            const popupParams = {
                view: 'Att1EngrTableEditTooltip',
                reference: '*[id=\'' + 'g-cell' + cellInfo.pos_y + '-' + cellInfo.pos_x + '\']',
                hasArrow: true,
                placement: 'right',
                whenParentScrolls: 'close',
                customClass: 'aw-engrtable-popupPanel',
                draggable: false,
                forceCloseOthers: false,
                subPanelContext: {
                    engrTable: engrTable,
                    openedObject: engrTable.selectedParameter,
                    cellTooltipInfo: cellInfo,
                    canShowEditCommand:engrTable.tableModel.tableName !== 'valueTable'
                }
            };
            popupService.show( popupParams ).then( function( popupRef ) {
                _popupRefEditGmm = popupRef;
                _loadingTooltip = false;
            } );
        }
    } else {
        isDoubleClick = false;
    }
};

/**
 * function to launch context menu popup
 * @param {*} event
 */
export let showContextMenuPopup = function( event, selection, engrTable, isShowValuesTable ) {
    const engrTableUpdated = engrTable;
    var tableName = engrTableUpdated.tableModel.tableName;
    engrTableUpdated[ tableName ].selectedCell = selection;
    CloseAllPopups();
    event.preventDefault();
    event.cancelBubble = true;
    var parameter = getSelectedParameter();
    const popupParams = {
        view: 'Att1EngrTableCtxMenu',
        whenParentScrolls: 'close',
        resizeToClose: true,
        autoFocus: true,
        forceCloseOthers: false,
        hasArrow: false,
        placement: 'right',
        targetEvent: event,
        reference: event.target,
        customClass: 'aw-engrtable-contextPopupPanel',
        subPanelContext: {
            engrTable: engrTable,
            openedObject: parameter,
            isShowValuesTable:isShowValuesTable
        }
    };
    popupService.show( popupParams ).then( function( popupRef ) {
        _popupRefCtx = popupRef;
    } );
};

/**
 * to close the opened popup
 * @param {*} data
 */
let closeEditGMMPopup = function() {
    _loadingTooltip = false;
    clearTimeout( _showId );
    if( _popupRefEditGmm ) {
        popupService.hide( _popupRefEditGmm );
        _popupRefEditGmm = null;
    }
};

/**
 * to start Edit on popup
 * @param {} data
 */
export let startEditModeForGMMPPopup = function( data ) {
    //  appCtxSvc.updatePartialCtx( 'goalTable.isTooltipDirty', true );
    var goal = _.clone( data.Goal );
    var min = _.clone( data.Min );
    var max = _.clone( data.Max );
    goal.isEditable = true;
    min.isEditable = true;
    max.isEditable = true;

    return {
        Goal: goal,
        Min: min,
        Max: max,
        isTooltipDirty: true
    };
};

/**
 * to save the popup Values
 * @param {*} data
 * @param {*} cellInfo
 */
export let saveGMMPopup = function( data, subPanelContext, cellInfo ) {
    var goal = _.clone( data.Goal );
    var min = _.clone( data.Min );
    var max = _.clone( data.Max );

    goal.isEditable = false;
    min.isEditable = false;
    max.isEditable = false;
    if( cellInfo.index === 'Measurement' ) {
        network_data.cells[ cellInfo.source ][ cellInfo.target ].Goal = data.Goal.uiValue;
    }
    network_data.cells[ cellInfo.source ][ cellInfo.target ].Min = data.Min.uiValue;
    network_data.cells[ cellInfo.source ][ cellInfo.target ].Max = data.Max.uiValue;

    //save operation
    //create the structure and call setComplexData()
    var cellValues = {};
    if( cellInfo.index === 'Measurement' ) {
        cellValues.Goal = data.Goal.dbValue;
    }

    cellValues.Min = data.Min.dbValue;
    cellValues.Max = data.Max.dbValue;

    var complexDataInput = [ {
        clientId: 'AWClient',
        parameters: [ {
            clientId: 'String',
            parameter: complexDataService.getSelectedParameterObject( subPanelContext ),
            goalTableInput: {
                operation: 'Update',
                tableData: {
                    rows: [ {
                        index: cellInfo.source,
                        cells: [ {
                            index: cellInfo.target,
                            cellValues: cellValues
                        } ]
                    } ]
                }
            }
        } ]

    } ];

    var parentObj = parameterMgmtUtil.getParentObjectForParameters();
    if( parentObj ) {
        complexDataInput[ 0 ].parent = parentObj;
    }

    eventBus.publish( 'Att1EngrTable.saveCellUpdates', { SOAInput: complexDataInput } );

    //close popup after save
    closeEditGMMPopup();

    // TODO : We need to revisit the flow of this function
    var jsonObject = createJson();
    var eventData = {
        network_data: network_data,
        tableName: jsonObject,
        undo: true
    };
    eventBus.publish( 'Att1EngrTable.updateEngrContext', eventData );

    return {
        Goal: goal,
        Min: min,
        Max: max,
        isTooltipDirty: false
    };
};

/**
 * To update Engr context
 * @param {*} eventData
 * @param {*} engrTable
 */
export let updateEngrContext = function( eventData, engrTable ) {
    let engrTableUpdated = engrTable;
    var tableName = engrTableUpdated.tableModel.tableName;

    engrTableUpdated[ tableName ].tableName = eventData.tableName;
    engrTableUpdated[ tableName ].undo = eventData.undo;
    engrTableUpdated.network_data = eventData.network_data;
    return { engrTable: engrTableUpdated };
};

/**
 * To update Engr context from tooltip
 * @param {*} data
 * @param {*} cellInfo
 */
export let updateEngrContextForWidePanel = function( eventData, engrTable ) {
    let engrTableUpdated = engrTable;
    engrTableUpdated.goalTable = { tableName: eventData.tableName };
    return { engrTable: engrTableUpdated };
};
/**
 * To get the popup  info for min and max
 * @param {*} data
 * @param {*} cellInfo
 */
export let getGMMPopupInfo = function( data, cellInfo ) {
    //set Min Max values
    var goal = _.clone( data.Goal );
    var min = _.clone( data.Min );
    var max = _.clone( data.Max );

    goal.dbValue = cellInfo.Goal;
    goal.uiValue = cellInfo.Goal;
    goal.isEditable = false;
    min.dbValue = cellInfo.Min;
    min.uiValue = cellInfo.Min;
    min.isEditable = false;
    max.dbValue = cellInfo.Max;
    max.uiValue = cellInfo.Max;
    max.isEditable = false;
    //appCtxSvc.updatePartialCtx( 'goalTable.isTooltipDirty', false );
    /*data.startEditOnGMMPopup = function( data ) {
        startEditModeForGMMPPopup( data );
    };*/
    /*data.saveOnGMMPopup = function( data ) {
        saveGMMPopup( data, cellInfo );
    };*/
    var editImagePath = getBaseUrlPath() + '/image/cmdEdit24.svg';
    var saveImagePath = getBaseUrlPath() + '/image/cmdSave16.svg';

    return {
        editImagePath: editImagePath,
        saveImagePath: saveImagePath,
        Goal: goal,
        Min: min,
        Max: max,
        isTooltipDirty: false
    };
};

/**
 * Save a modified cell value to the database.
 * @param {*} cellInfo Data object for modified cell
 */
export let saveEdit = function( cellInfo, engrTableUpdated ) {
    if( cellInfo.cellType !== 'cell' ) {
        var json;
        // not sure how to save single header edit so save full table
        if( engrTableUpdated.tableModel.tableName === 'valueTable' ) {
            json = createJson( true );
            engrTableUpdated.valueTable.tableName = json;
            eventBus.publish( 'saveAttributeComplexMeasurementSoaCall' );
        } else {
            json = createJson();
            engrTableUpdated.goalTable.tableName = json;
            eventBus.publish( 'setAttributeComplexDataSoaCallSave' );
        }
        return;
    }

    //save operation
    var complexDataInput = [ {
        clientId: 'AWClient',
        parameters: [ {
            clientId: 'Parameters',
            parameter: getSelectedParameter(),
            goalTableInput: {},
            valueInputs: []
        } ]
    } ];

    var cellValues = {};
    if( cellInfo.index === 'Measurement' ) {
        cellValues.Value = cellInfo.text;
    } else {
        cellValues[ cellInfo.index ] = cellInfo.text;
    }

    var tableInput = {
        operation: 'Update',
        tableData: {
            rows: [ {
                index: cellInfo.source,
                cells: [ {
                    index: cellInfo.target,
                    cellValues: cellValues
                } ]
            } ]
        }
    };

    if( cellInfo.index === 'Measurement' ) {
        var valueTable = {
            measureValue: complexDataService.getSelectedMeasurement(),
            valueTableInput: {
                operation: 'Update',
                rows: tableInput.tableData.rows
            }
        };
        complexDataInput[ 0 ].parameters[ 0 ].valueInputs.push( valueTable );
    } else {
        complexDataInput[ 0 ].parameters[ 0 ].goalTableInput = tableInput;
    }

    var parentObj = parameterMgmtUtil.getParentObjectForParameters();
    if( parentObj ) {
        complexDataInput[ 0 ].parent = parentObj;
    }
    // call updateParameters2 to update the complex data
    if( network_data.tableName === 'valueTable' ) {
        eventBus.publish( 'Att1MeasurementsView.saveCellUpdates', { SOAInput: complexDataInput } );
    } else {
        eventBus.publish( 'Att1EngrTable.saveCellUpdates', { SOAInput: complexDataInput } );
    }
    att1ChartService.updateChartData( [ cellInfo ], engrTableUpdated, true );
};

/**
 * Clear contents of selected cell or row or column
 */
export let clearContents = function( engrTable ) {
    CloseAllPopups();
    var undoCells = [];
    let engrTableUpdated = engrTable;
    engrTableUpdated.network_data = network_data;
    var tableData = engrTableUpdated.network_data;
    var selection = getSelectedCells( engrTable );
    if( !selection ) {
        var selected = getSelection( engrTable );
        if( selected && selected.cellType === 'series' ) {
            selection = [ selected ];
        } else {
            return;
        }
    }
    for( var num = 0; num < selection.length; ++num ) {
        var cells = tableData.cells;
        if ( !selection[num].editable ) {
            continue;
        }
        undoCells.push( Object.assign( {}, selection[num] ) );
        if( selection[ num ].cellType === 'column' ) {
            var index = selection[ num ].index;
            var pos_y = selection[ num ].pos_y - tableData.headerRowCount;
            for( var i = 0; i < pos_y; ++i ) {
                cells[ i ][ index ] = '';
            }
        } else if( selection[ num ].cellType === 'row' ) {
            var headers = tableData.displayHeaders;
            var index = selection[ num ].index - 1;
            var pos_y = selection[ num ].pos_y;
            for( var i = 0; i < pos_y; ++i ) {
                for( var j = 0; j < headers; ++j ) {
                    cells[ index ][ i ][ j ] = '';
                }
            }
        } else if( selection[ num ].cellType === 'cell' ) {
            var numValues = tableData.numValues;
            var index = selection[ num ].index;

            if( numValues > 1 ) {
                var pos_x = selection[ num ].pos_x - tableData.headerColCount;
                if( pos_x > 0 ) {
                    pos_x = Math.floor( pos_x / numValues );
                }
            } else {
                var pos_x = selection[ num ].pos_x - tableData.headerColCount;
            }
            var pos_y = selection[ num ].pos_y - tableData.headerRowCount;
            cells[ pos_y ][ pos_x ][ index ] = '';
        } else if( selection[ num ].cellType === 'series' && selection.length === 1 ) {
            var series = tableData.columnSeries[ selection[ num ].index ];
            series.text = '';
            series.displayText = '';
            series.units = '';
        }
    }
    saveChanges( tableData, engrTableUpdated );
    addUndo( createEditOperation( 'editCells', undoCells, undoCells ), engrTable );
    eventBus.publish( 'engrTable.updateSelection', { selection: [] } );
};

/**
 * Set the value of cells in the table. Cell data objects contain the cell ids and values to use.
 * @param {*} cells List of cell data objects.
 * @param {*} tableData The table data
 */
let setCellValues = function( cells, tableData, modelCells ) {
    cells.forEach( cellData => {
        if ( cellData.editable === false ) {
            return;
        }
        var cell = d3.select( '.text' + cellData.pos_y + '-' + cellData.pos_x );
        var data = cell.data()[0];
        if ( !data ) {
            data = cellData;
            data.isEditing = false;
        } else {
            data.text = cellData.text;
            data.isDirty = cellData.isDirty;
            cell.classed( 'dirty', data.isDirty );
            cell.text( cellData.displayText ? cellData.displayText : cellData.text );
        }
        switch ( data.cellType ) {
            case 'cell':
                tableData.cells[data.source][data.target][data.index] = cellData.text;
                setDirty( tableData.cells[data.source][data.target], data, cellData.isDirty );
                break;
            case 'column':
                tableData.columnHeaders[data.index].text = cellData.text;
                tableData.columnHeaders[data.index].displayText = cellData.displayText;
                tableData.columnHeaders[data.index].units = cellData.units;
                data.displayText = cellData.displayText;
                data.units = cellData.units;
                break;
            case 'row':
                if ( tableData.hasRowHeaders ) {
                    tableData.rowHeaders[data.index].text = cellData.text;
                }
                break;
            case 'series':
                tableData.columnSeries[data.index].text = cellData.text;
                tableData.columnSeries[data.index].displayText = cellData.displayText;
                tableData.columnSeries[data.index].units = cellData.units;
                data.displayText = cellData.displayText;
                data.units =  cellData.units;
                break;
        }
    } );
    if ( modelCells ) {
        modelCells.forEach( cell => {
            tableData.cells[cell.source][cell.target] = cell;
        } );
    }
};

/**
 * Undo previously done changes.
 * @param {*} engrTable The table data
 */
export let undoChanges = function( engrTable ) {
    let engrTableUpdated = engrTable;
    var tableData = network_data;
    try {
        var undoOp = undoStack.pop();
        tableData.undoInProgress = true;

        switch ( undoOp.operation ) {
            case 'editCells':
                setCellValues( undoOp.cells, tableData );
                break;
            case 'insertRow':
                deleteRow( undoOp.cells, tableData, engrTable );
                break;
            case 'insertRowHeaders':
                deleteRowHeaders( tableData, engrTable );
                break;
            case 'insertColumn':
                deleteColumn( undoOp.cells, tableData, engrTable );
                break;
            case 'deleteRow':
                insertRow( true, engrTable, true, undoOp.selections );
                setCellValues( undoOp.cells, tableData, undoOp.modelCells );
                break;
            case 'deleteRowHeaders':
                insertRowHeaders( engrTable );
                setCellValues( undoOp.cells, tableData );
                break;
            case 'deleteColumn':
                insertColumn( false, engrTable, undoOp.selections );
                setCellValues( undoOp.cells, tableData, undoOp.modelCells );
                break;
        }
        saveChanges( tableData, engrTableUpdated );
        setSelections( undoOp.selections );
        Att1ChartService.updateChartData( undoOp.cells, engrTableUpdated, true );
    } catch ( err ) {
        resetUndo( engrTable );
    } finally {
        tableData.undoInProgress = false;
        engrTable[ tableData.tableName ].undo = undoStack.length > 0;
    }
};

/**
 * Clear the undo stack.
 * @param {*} tableData The table data
 */
let resetUndo = function( engrTable ) {
    undoStack = [];
    if ( engrTable && engrTable.tableModel ) {
        var tableData = engrTable.tableModel.tableData;
        engrTable[ tableData.tableName ].undo = false;
    }
};

/**
 * function to launch update column header and unit of measure popup
 */
export let showUpdateUomPopup = function( engrTable ) {
    const engrTableUpdated = engrTable;
    var selectedTable = engrTableUpdated.tableModel;
    if( selectedTable && selectedTable.tableName === 'valueTable' ) {
        // Do not show update uom popup for measurements
        return;
    }
    var selection = getSelection( engrTableUpdated );
    var selectionX = -1;
    var selectionY = -1;
    var selectionIn = -1;

    if( selection ) {
        selectionX = selection.pos_x;
        selectionY = selection.pos_y;
        selectionIn = selection.index;
        uomIndex = selectionIn;
    }

    CloseAllPopups();
    event.preventDefault();
    event.cancelBubble = true;

    const popupParams = {
        view: 'Att1UpdateUom',
        whenParentScrolls: 'follow',
        resizeToClose: true,
        autoFocus: true,
        forceCloseOthers: false,
        hasArrow: false,
        placement: 'bottom',
        targetEvent: event,
        reference: 'g-cell' + selectionY + '-' + selectionX,
        customClass: 'aw-engrtable-popupPanel',
        subPanelContext: {
            cellUomInfo: selection,
            engrTable: engrTableUpdated
        }
    };

    popupService.show( popupParams ).then( function( popupRef ) {
        _popupRefUom = popupRef;
    } );
};

/**
 * function to set column header and unit of measure popup
 * @param data
 */
export let setHeaderAndUom = function( data, engrTable ) {
    const engrTableUpdated = engrTable;
    engrTableUpdated.network_data = network_data;
    var tableData = engrTableUpdated.network_data;
    var selection = getSelection( engrTable );
    var op = createEditOperation( 'editCells', [ selection ], [ selection ] );
    var title = data.ColumnHeaderName.dbValue;
    var units = data.lovUnitProp.uiValue;
    var unitsUid = data.lovUnitProp.dbValue;
    var unitIndex = -1;
    var unitsArray = [];
    var unitsJson;
    var newHeaderText;
    var isValid = false;
    for( var i = 0; i < listValues.length; ++i ) {
        if( units === listValues[ i ].propDisplayValue ) {
            isValid = true;
            break;
        }
    }
    if( isValid === true ) {
        if( units === '' ) {
            newHeaderText = title;
        } else {
            newHeaderText = title + ' (' + units + ')';

            if( tableData.units ) {
                var listUnits = tableData.units;
                for( var i = 0; i < listUnits.length; ++i ) {
                    if( listUnits[ i ].symbol === units ) {
                        // if unit is available in the list
                        unitIndex = i;
                        break;
                    }
                }
                if( unitIndex === -1 ) {
                    // if unit is not available in the list
                    unitsJson = { symbol: units, uid: unitsUid };
                    unitIndex = tableData.units.length;
                    tableData.units.push( unitsJson );
                }
            } else {
                // if units list is undefined
                unitsJson = { symbol: units, uid: unitsUid };
                unitsArray.push( unitsJson );
                tableData.units = unitsArray;
                unitIndex = 0;
            }
        }

        if( selection && selection.cellType === 'column' ) {
            tableData.columnHeaders[ uomIndex ].text = title;
            tableData.columnHeaders[ uomIndex ].units = unitIndex;
            tableData.columnHeaders[ uomIndex ].displayText = newHeaderText;
        } else if( selection && selection.cellType === 'series' ) {
            tableData.columnSeries[ uomIndex ].text = title;
            tableData.columnSeries[ uomIndex ].units = unitIndex;
            tableData.columnSeries[ uomIndex ].displayText = newHeaderText;
            for( var i = tableData.columnSeries[ uomIndex ].start; i < tableData.columnSeries[ uomIndex ].start + tableData.columnSeries[ uomIndex ].count; i++ ) {
                if( tableData.columnHeaders[ i ].units !== '' && ( tableData.columnHeaders[ i ].series !== undefined || tableData.columnHeaders[ i ].series > -1 ) ) {
                    tableData.columnHeaders[ i ].units = '';
                    tableData.columnHeaders[ i ].displayText = tableData.columnHeaders[ i ].text;
                }
            }
        }
        updateChanges( tableData, engrTableUpdated );
        CloseAllPopups();
        addUndo( op, engrTable, true );
        var jsonObject = createJson();
        var eventData = {
            network_data: network_data,
            tableName: jsonObject,
            undo: true
        };
        eventBus.publish( 'Att1EngrTable.updateEngrContext', eventData );
    }
};
let updateChanges = function( tableData, engrTableUpdated ) {
    var eventData = {
        tableData: tableData
    };

    if( tableData.editMode ) {
        tableData.table.isDirty = true;
    } else {
        updateEngrTable( engrTableUpdated );
    }
    refreshTable( eventData, engrTableUpdated );
};
export let updateEngrTable = function( engrTableUpdated ) {
    var tableName = engrTableUpdated.tableModel.tableName;

    engrTableUpdated[ tableName ].isDirty = undefined;

    var complexDataInput = [];

    var jsonObject = createJson();
    var selectedObject = getSelectedParameter();
    engrTableUpdated.goalTable.tableName = jsonObject;
    complexDataInput.push( {
        clientId: 'AWClient',
        parameters: [ {
            clientId: 'AWClient',
            parameter: selectedObject,
            goalTableInput: {
                operation: 'Create',
                jsonString: jsonObject
            }
        } ],
        parent: selectedObject
    } );

    eventBus.publish( 'Att1EngrTable.saveCellUpdates', { SOAInput: complexDataInput } );
};
/**
 * Hide the opened popup panel and remove all event subscriptions as well.
 */
export let closeContextMenuPopup = function() {
    if( _popupRefCtx ) {
        popupService.hide( _popupRefCtx );
        _popupRefCtx = null;
    }
};
/**
 * Hide the all opened popup panel and remove all event subscriptions as well.
 */
let CloseAllPopups = function() {
    if( _popupRefUom ) {
        popupService.hide( _popupRefUom );
        _popupRefUom = null;
    }
    if( _popupRefCtx ) {
        popupService.hide( _popupRefCtx );
        _popupRefCtx = null;
    }
    if( _popupRefEditGmm ) {
        popupService.hide( _popupRefEditGmm );
        _popupRefEditGmm = null;
    }
};

/**
 * Hide the opened popup panel and remove all event subscriptions as well.
 */
export let closeUpdateUomPopup = function() {
    if( _popupRefUom ) {
        popupService.hide( _popupRefUom );
        _popupRefUom = null;
        var eventData = {
            networkData: network_data
        };
        refreshMatrix( eventData );
    }
};

/**
 * function to populate Unit of measure LOV
 * @param response
 * @param data
 */
export let processUomLOV = function( response, data, engrTable ) {
    var cellInfo = getSelection( engrTable );
    listValues = [];
    var listItem = {};
    for( var i = 0; i < response.lovValues.length; i++ ) {
        var value = response.lovValues[ i ].propDisplayValues.lov_values[ 0 ];
        var uid = response.lovValues[ i ].propInternalValues.lov_values[ 0 ];
        listItem = { propDisplayValue: value, dispValue: value, propInternalValue: uid };
        listValues.push( listItem );
    }
    eventBus.publish( 'Att1UpdateUom.populateList', data, cellInfo );
};

/**
 * To get the popup  info for unit of measure
 * @param {*} data
 * @param {*} cellInfo
 */
export let getUomPopupInfo = function( data, cellInfo ) {
    //set uom popup info

    const ColumnHeaderName = _.clone( data.ColumnHeaderName );
    const lovUnitProp = _.clone( data.lovUnitProp );
    const lovUnitPropOptions = _.clone( data.lovUnitPropOptions );

    ColumnHeaderName.dbValue = cellInfo.text;
    ColumnHeaderName.uiValue = cellInfo.text;
    if( cellInfo.units !== undefined && cellInfo.units !== '' ) {
        lovUnitProp.uiValue = network_data.units[ cellInfo.units ].symbol;
        lovUnitProp.dbValue = network_data.units[ cellInfo.units ].uid;
    } else {
        lovUnitProp.uiValue = '';
        lovUnitProp.dbValue = '';
    }

    lovUnitPropOptions.dbValue = listValues;
    lovUnitPropOptions.uiValue = listValues;

    return {
        ColumnHeaderName: ColumnHeaderName,
        lovUnitProp: lovUnitProp,
        lovUnitPropOptions: lovUnitPropOptions
    };
};

/**
 * Save engrtable changes to db
 * Refresh client to show updated table.
 * @param {*} table The updated table data
 */
export let saveChangesForMeasurementsTable = function( table, engrTable ) {
    var eventData = {
        tableData: table.tableData
    };
    refreshTable( eventData, engrTable );
    var json;
    if( table.tableName === 'valueTable' ) {
        json = createJson( true );
        engrTable.valueTable.tableName = json;
        eventBus.publish( 'saveAttributeComplexMeasurementSoaCall', { refresh: true } );
    }
};

/**
 * Method to attach the leave place listener
 */
export let attachLeavePlaceHandler = function( subPanelContext, data ) {
    if( !subPanelContext.parametersTable ) {
        localeService.getTextPromise( 'TCUICommandPanelsMessages' ).then( function( textBundle ) {
            singleLeaveConfirmation = textBundle.navigationConfirmationSingle;
            saveTxt = textBundle.save;
            discardTxt = textBundle.discard;
            leaveHandler = {
                okToLeave: leaveConfirmation,
                data: data
            };

            leavePlaceService.registerLeaveHandler( leaveHandler );
        } );
    }
};

/**
 * Method to show the confirmation dialog
 */
export let leaveConfirmation = function() {
    var data = leaveHandler.data;
    var isDirty = false;
    var engrTable = data.atomicDataRef.engrTable.getAtomicData();
    if( engrTable.goalTable ) {
        isDirty = engrTable.goalTable.isDirty;
    } else if( engrTable.measurementTable && engrTable.valueTable ) {
        isDirty = engrTable.valueTable.isDirty;
    }
    if( isDirty ) {
        leavePlaceService.deregisterLeaveHandler( leaveHandler );
        return displayNotificationMessage( singleLeaveConfirmation, saveTxt, discardTxt, leaveHandler );
    }
    var defer = AwPromiseService.instance.defer();
    defer.resolve();
    return defer.promise;
};

/**
 * Function to add button on notification dialog
 */
function createButton( label, callback ) {
    return {
        addClass: 'btn btn-notify',
        text: label,
        onClick: callback
    };
}

/**
 * Method to create popup
 */
var displayNotificationMessage = function( singleLeaveConfirmation, saveTxt, discardTxt, leaveHandler ) {
    //If a popup is already active just return existing promise
    var defer = AwPromiseService.instance.defer();
    var message = singleLeaveConfirmation;
    var objectName = '';
    if( appCtxSvc.ctx.mselected[ 0 ].props.object_name ) {
        objectName = appCtxSvc.ctx.mselected[ 0 ].props.object_name.uiValues[ 0 ];
    } else {
        var selectedParameter = appCtxSvc.getCtx( 'xrtSummaryContextObject' );
        if( selectedParameter ) {
            objectName = selectedParameter.props.object_name.uiValues[ 0 ];
        }
    }
    message = singleLeaveConfirmation.replace( '{0}', objectName );
    var buttonArray = [];
    buttonArray.push( createButton( discardTxt, function( $noty ) {
        $noty.close();
        defer.resolve();
    } ) );
    buttonArray.push( createButton( saveTxt, function( $noty ) {
        eventBus.publish( 'Att1EngrTable.saveEdits' );
        $noty.close();
        defer.resolve();
    } ) );
    notyService.showWarning( message, buttonArray );
    return defer.promise;
};

export let getParameterComplexData = function( subPanelContext, data, importCompleted ) {
    var attrTableProp;
    var isNoAttrTable;
    var selectedObject;
    var parametersTable = undefined;
    if( subPanelContext.parametersTable ) {
        parametersTable = subPanelContext.parametersTable.getValue();
    }
    if( data && data.eventData && data.eventData.selectedObject ) {
        selectedObject = data.eventData.selectedObject;
    }

    if( !selectedObject && parametersTable ) {
        selectedObject = parametersTable.selectedUnderlyingObjects;
    }
    if( selectedObject ) {
        attrTableProp = selectedObject[ 0 ].props.att0AttributeTable;
        m_selectedParameter = parametersTable.selectedUnderlyingObjects[ 0 ];
    } else if( subPanelContext.openedObject.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1 ) {
        attrTableProp = subPanelContext.openedObject.props.att0AttributeTable;
        m_selectedParameter = subPanelContext.openedObject;
    }
    if( attrTableProp ) {
        isNoAttrTable = attrTableProp.dbValues && attrTableProp.dbValues[ 0 ] === undefined || attrTableProp.dbValues[ 0 ] === null || attrTableProp.dbValues[ 0 ] === '';
    }
    var isImportOrAddTableInProgress = !importCompleted && parametersTable &&
        ( parametersTable.isComplexDataImportInProgress || parametersTable.addNewTableValueCommandClicked );
    if( isNoAttrTable || isImportOrAddTableInProgress ) {
        return {
            selectedParameter: m_selectedParameter
        };
    }
    resetUndo();
    eventBus.publish( 'Att1EngrTable.getAttributeComplexDataSOACall', { selectedObject: selectedObject } );
    return {
        selectedParameter: m_selectedParameter
    };
};

export let updateTabData = function( data ) {
    eventBus.publish( 'Att1EngrTable.getDataFromServer', { selectedObject: data.eventData.selectedParameter } );
};

/**
 *
 * @param {Object} rows the rows array to save
 * @param {String} tableName the table name currently loaded
 */
export let saveColumnFillCells = function( rows, tableName ) {
    var complexDataInput = [ {
        clientId: 'AWClient',
        parameters: [ {
            clientId: 'Parameters',
            parameter: getSelectedParameter(),
            goalTableInput: {},
            valueInputs: []
        } ]
    } ];

    var tableInput = {
        operation: 'Update',
        tableData: {
            rows: rows
        }
    };

    if( tableName === 'valueTable' ) {
        var valueTable = {
            measureValue: complexDataService.getSelectedMeasurement(),
            valueTableInput: {
                operation: 'Update',
                rows: tableInput.tableData.rows
            }
        };
        complexDataInput[ 0 ].parameters[ 0 ].valueInputs.push( valueTable );
    } else {
        complexDataInput[ 0 ].parameters[ 0 ].goalTableInput = tableInput;
    }

    var parentObj = parameterMgmtUtil.getParentObjectForParameters();
    if( parentObj ) {
        complexDataInput[ 0 ].parent = parentObj;
    }
    // call updateParameters2 to update the complex data
    if( network_data.tableName === 'valueTable' ) {
        eventBus.publish( 'Att1MeasurementsView.saveCellUpdates', { SOAInput: complexDataInput } );
    } else {
        eventBus.publish( 'Att1EngrTable.saveCellUpdates', { SOAInput: complexDataInput } );
    }
};

/**
 * Method to handle the column copy command
 * @param {Object} engrTable the Engineering table context
 */
export let handleColumnCopyFill = function( engrTable ) {
    CloseAllPopups();
    var selectedCell = getSelectedCells( engrTable );
    var totalRows = engrTable.tableModel.tableData.totalRows;
    var undoCells = [];
    var cellsToUpdateInChart = [];
    var tableData = engrTable.network_data;
    var rows = [];
    var rowsMap = new Map();
    for( var  i = 0; i < selectedCell.length; i++ ) {
        var isCellVisible = true;
        var selectedCellPosX = selectedCell[i].pos_x;
        var selectedCellPosY = selectedCell[i].pos_y;
        for( var j = selectedCellPosY + 1; j < totalRows; j++ ) {
            var cell = matrix[ j ][ selectedCellPosX ];
            undoCells.push( Object.assign( {}, cell ) );
            cell.text = selectedCell[i].text;
            var row = {};
            row.cells = [];
            row.index = cell.source;
            if( !rowsMap.has( cell.source ) ) {
                rowsMap.set( cell.source, row );
            }
            row = rowsMap.get( cell.source );
            var cellValues = {};
            if( cell.index === 'Measurement' ) {
                cellValues.Value = selectedCell[i].text;
            } else {
                cellValues[ cell.index ] = selectedCell[i].text;
            }
            row.cells.push( { index:cell.target, cellValues:cellValues } );
            if( isCellVisible ) {
                var text = '.text' + j + '-' + selectedCellPosX;
                var textElement = d3.select( text );
                if( textElement  && !textElement.empty() ) {
                    textElement.text( selectedCell[ i ].text );
                } else if( textElement.empty() ) {
                    isCellVisible = false;
                }
            }
            tableData.cells[ cell.source ][ cell.target ][cell.index] =  selectedCell[i].text;
            cellsToUpdateInChart.push( cell );
        }
    }
    rows = [ ...rowsMap.values() ];
    saveColumnFillCells( rows, engrTable.tableModel.tableName );
    if( engrTable.chartSeriesData ) {
        att1ChartService.updateChartData( cellsToUpdateInChart, engrTable, true );
    }
    addUndo( createEditOperation( 'editCells', undoCells, undoCells ), engrTable );
    network_data = engrTable.network_data;
    return {
        engrTable:engrTable
    };
};

export default exports = {
    addNewComplexTable,
    createJson,
    processPartialErrorForComplexData,
    saveEditEngrTable,
    refreshMatrix,
    insertRow,
    deleteRowOrColumn,
    insertColumn,
    copyCells,
    cutCells,
    pasteCells,
    startEditInEngrTable,
    getGMMPopupInfo,
    showEditGMMPopup,
    startEditModeForGMMPPopup,
    saveGMMPopup,
    createGrid,
    showContextMenuPopup,
    showPopup,
    clearContents,
    undoChanges,
    insertColumnSeries,
    insertRowHeaders,
    showUpdateUomPopup,
    setHeaderAndUom,
    closeUpdateUomPopup,
    processUomLOV,
    getUomPopupInfo,
    saveChangesForMeasurementsTable,
    closeContextMenuPopup,
    updateEngrTable,
    getSelectedParameter,
    attachLeavePlaceHandler,
    getParameterComplexData,
    removeListeners,
    getSelectedMeasurement,
    updateSelection,
    updateChangesEngrTable,
    editCellCallBack,
    loadEngrTableCtx,
    resizeColumn,
    dblresizeColumn,
    updateEngrContext,
    updateTabData,
    updateEngrContextForWidePanel,
    redrawTable,
    updateUndo,
    selectCell,
    handleColumnCopyFill,
    getViewerHeight,
    getEngrDisplayPropNames,
    getGMMMDisplayNames,
    localizeHeaders
};
