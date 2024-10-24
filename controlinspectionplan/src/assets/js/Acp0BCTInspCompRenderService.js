// Copyright (c) 2022 Siemens

/**
 * @module js/Acp0BCTInspCompRenderService
 */
import appCtxService from 'js/appCtxService';
import { bctInspectorService, BctInspectorViewer, BctInspectorViewerTable } from '@swf/bct-inspector-viewer';
import acp0BCTInspUtilService from 'js/Acp0BCTInspUtilService';
import listBoxService from 'js/listBoxService';
import eventBus from 'js/eventBus';
import bctRenderServiceUri from '@swf/bct-inspector-viewer/build/bct-render-service.wasm';
import { setUris } from '@swf/bct-inspector-viewer';
setUris( { 'bct-render-service.wasm': bctRenderServiceUri } );

// Define the default view for inspector viewer
appCtxService.registerCtx( 'inspDrawingViewMode', true );
//Define the default balloon selection flag
appCtxService.registerCtx( 'isSelectAllBalloonActive', false );
//Define the default hidden balloon selection flag
appCtxService.registerCtx( 'isHideAllBalloonActive', false );
// Map of selected Sheet and selected balloon or row which is maintainnig selection data in context of selected part revision
var _mapOfSheetAndSelectedBalloonsOrRows = new Map();
//Map of sheet and active mode of selection of balloon.
var _mapOfSheetAndSelectAllMode = new Map();

//Map of Char Options
var _mcharOptions = new Map();
//List of updated imported PMI
var _mUpdatedImportedPMICharUId = [];
//Creating map to maintain multiple sheets and their characteristics
var _mapOfSheetAndCharacteristics = new Map();
var exports = {};
var bctInspectorViewer = undefined;
var modelList = undefined;
var viewSelected = undefined;
var defaultConstant = 'Default';
var isShowViewChanged = false;
var isDrawingElementRemoved = false;
var isPMITabViewSelected = false;
var pmiBalloonView = '';
var bctDrawingHeightInPercentage = 70.0;

import $ from 'jquery';

/*
 * Set the height of BCT viewer (Drawing and/or Table).
 */
export let setBctViewerHeight = function( data ) {
    // Take total height for BCT veiwer in full screen and normal window in Ballooning tab.
    let isFullscreen = data.subPanelContext ? data.subPanelContext.fullScreenState.value : false;
    let viewPortHeight = $( window ).height();

    // Check whether header exists or not.
    var commandBars = document.querySelectorAll( '.aw-selection-summary-header' );
    let headerExists = commandBars.length >= 1;

    let heightWithFullScreen = viewPortHeight - 115;
    let heightWithoutFullScreen = viewPortHeight - ( headerExists ? 315 : 245 );

    // Take total height for BCT veiwer in full screen and normal window in PMI tab .
    var selectedTab = data.subPanelContext ? data.subPanelContext.xrtState.value.selectedTab : false;
    if ( selectedTab === 'tc_xrt_PMI' ) {
        // Check status(expand/collapsed) of PMI section and set height.
        heightWithoutFullScreen = viewPortHeight - ( headerExists ? 530 : 462 );
        if ( data.eventData && data.eventData.caption === 'PMI' && data.eventData.isCollapsed ) {
            heightWithoutFullScreen = viewPortHeight - ( headerExists ? 405 : 340 );
        }
    }
    let height = isFullscreen ? heightWithFullScreen : heightWithoutFullScreen;

    // Find the height of drawing and table to render it into the BCT veiwer.
    let partToInspectHeight = height - 45;
    let drwHeight = height;
    let tblHeight = height;
    var renderPart = appCtxService.ctx.selectedPart;
    if ( renderPart ) {
        if ( selectedTab === 'tc_xrt_PMI' ) {
            // Now are we showing only Drawing So set full height for drawing and table.
            partToInspectHeight = 0;
            drwHeight -= 25;
            tblHeight -= 25;
        } else {
            // Top toolbar size increases after showing drawing in bct viewer to show model view list into toolbar.
            partToInspectHeight -= 35;

            // Select the height if part is selected to render the drawing in BCT veiwer.
            var ctx = appCtxService.getCtx();
            if ( ctx.inspCombineViewMode ) {
                // Now are we showing both Drawing and Table, So share height between drawing and table.
                let bctTableHeightInPercentage = 100.0 - bctDrawingHeightInPercentage;
                drwHeight = height * ( bctDrawingHeightInPercentage / 100.0 );
                tblHeight = height * ( bctTableHeightInPercentage / 100.0 );
                drwHeight -= 20;
                if ( !isFullscreen && !headerExists ) {
                    drwHeight -= 25;
                }

                if( drwHeight < 0 ) {
                    tblHeight += drwHeight;
                    drwHeight = 0;
                }
            } else {
                // Now are we showing only Drawing or Table, So set full height for drawing and table.
                drwHeight -= 25;
                tblHeight -= 25;
            }
        }
    } else {
        // Set height of part to inspect section.
        if ( !isFullscreen && !headerExists ) {
            partToInspectHeight = height - 47;
        }

        // Select the height if part is not selected to render the drawing in BCT veiwer.
        drwHeight = height / 3.0;
        tblHeight = height / 3.0;
    }

    // Remove 'flex-basis' property from drawing and table element.
    // This property causing issue(Table appear in small size) in full screen mode.
    var drawing = document.querySelector( '.aw-controlinspectionplan-drawingHeight' );
    var table = document.querySelector( '.aw-controlinspectionplan-tableHeight' );
    if ( drawing && table ) {
        drawing.style.removeProperty( 'flex-basis' );
        table.style.removeProperty( 'flex-basis' );
    }

    // Update css to set height of BCT viewer (Drawing and/or Table) and 'Part To Inspect' Section.
    $( '.aw-controlinspectionplan-drawingHeight' ).css( 'height', drwHeight + 'px' );
    $( '.aw-controlinspectionplan-tableHeight' ).css( 'height', tblHeight + 'px' );
    $( '.aw-controlinspectionplan-refPartsHeight .sw-section-content' ).css( 'height', partToInspectHeight + 'px' );
    $( '.aw-controlinspectionplan-partsToInspectHeight .sw-section-content' ).css( 'height', partToInspectHeight + 'px' );
};

/*
 * Update the height of BCT viewer.
 */
export let updateBctViewerHeight = function( data ) {
    // Check whether full screen and header exists or not.
    let isFullscreen = data.subPanelContext ? data.subPanelContext.fullScreenState.value : false;
    var commandBars = document.querySelectorAll( '.aw-selection-summary-header' );
    let headerExists = commandBars.length >= 1;

    // Update the height of BCT drawing.
    if ( data && data.eventData && data.eventData.area1.id === 'bctDrawingFrameID' && data.eventData.area2.id === 'bctTableFrameID' ) {
        var drawing = document.querySelector( '.aw-controlinspectionplan-drawingHeight' );
        var table = document.querySelector( '.aw-controlinspectionplan-tableHeight' );
        if ( drawing && table ) {
            var drwHeight = drawing.offsetHeight;
            var tblHeight = table.offsetHeight;
            drwHeight += 20;
            if ( !isFullscreen && !headerExists ) {
                drwHeight += 25;
            }
            bctDrawingHeightInPercentage = drwHeight / ( drwHeight + tblHeight ) * 100.0;
        }
    }
};


/*
   *This method called on selection change in drawing sheet list box.
   */
export let drawingSheetSelectionChange = function( data ) {
    var ctx = appCtxService.getCtx();
    if ( data.acp0DrawingSheetList && ctx.selectedSheet !== data.acp0DrawingSheetList.dbValue ) {
        ctx.isSelectAllBalloonActive = _mapOfSheetAndSelectAllMode.get( data.acp0DrawingSheetList.dbValue );
        ctx.isSelectAllBalloonActive = ctx.isSelectAllBalloonActive === undefined ? false : ctx.isSelectAllBalloonActive;
        appCtxService.updateCtx( 'isHideAllBalloonActive', false );
        data.selectedView.dbValue = defaultConstant;
        data.selectedView.uiValue = defaultConstant;
        viewSelected = '';
        appCtxService.updateCtx( 'selectedModelViewName', data.selectedView.uiValue );
        isShowViewChanged = false;
        isDrawingElementRemoved = false;
        exports.renderBCTInspViewer( data );
        modelList = undefined;
        eventBus.publish( 'Acp0.getModelViews' );
    }
};

/*
   *This method called on selection change in model views
   */
export let modelViewChange = function( data ) {
    var ctx = appCtxService.getCtx();
    if ( data && data.selectedView && ctx.selectedModelViewName !== data.selectedView.uiValue ) {
        appCtxService.updateCtx( 'selectedModelViewName', data.selectedView.uiValue );
        appCtxService.updateCtx( 'isHideAllBalloonActive', false );
        //if view is different than default, update view selected and render drawing else render default drawing
        if ( data.selectedView.uiValue !== defaultConstant ) {
            viewSelected = {
                id: data.selectedView.dbValue,
                name: '"' + data.selectedView.uiValue + '"'
            };
            renderBCTInspViewer( data );
        } else {
            data.selectedView.dbValue = defaultConstant;
            data.selectedView.uiValue = defaultConstant;
            viewSelected = '';
            appCtxService.updateCtx( 'selectedModelViewName', data.selectedView.uiValue );
            renderBCTInspViewer( data );
        }
    }
};

/**
 *Fetch all the views for the drawing
 * @returns {object}views- list of objects
 */
export let getModelViews = function() {
    // Add default view first.
    var views = [];
    views.push( { propDisplayValue: defaultConstant, dispValue: defaultConstant, propInternalValue: defaultConstant } );
    if ( modelList ) {
        for ( var view of modelList.modelViews ) {
            var name = view.name.replace( '\"', '' ).replace( '\"', '' );
            views.push( { propDisplayValue: name, dispValue: name, propInternalValue: view.id } );
        }
    }
    return { modelViews: views };
};

/**
   * Get all Characteristics from selected sheet.
   * @param {array} defaultCharacteristics List of Characteristics in drawing.
   * @returns {array} Characteristics.
   */
function getCharacteristicsFromSelectedView( defaultCharacteristics ) {
    var charList = [];
    var ctx = appCtxService.getCtx();
    var selectedModelViewName = ctx.selectedModelViewName;
    if ( selectedModelViewName && selectedModelViewName !== defaultConstant ) {
        for ( var char of defaultCharacteristics ) {
            if ( char.viewName === selectedModelViewName ) {
                charList.push( char );
            }
        }
    } else {
        charList = defaultCharacteristics;
    }
    //managing visibility of select all command
    //Get already selected characteristics
    if( _mapOfSheetAndSelectedBalloonsOrRows.get( appCtxService.ctx.selectedSheet ) ) {
        var selectedCharacteristics = _mapOfSheetAndSelectedBalloonsOrRows.get( appCtxService.ctx.selectedSheet );
        ctx.isSelectAllBalloonActive = charList.every( elem => selectedCharacteristics.includes( elem ) );
        if( charList.length === 0 ) { ctx.isSelectAllBalloonActive = false; }
    }
    //Updating selected sheet characteristics in ctx
    ctx.selectedSheet.characteristics = charList;
    appCtxService.updateCtx( 'selectedSheet', ctx.selectedSheet ? ctx.selectedSheet : appCtxService.getCtx( 'selectedSheet' ) );
    return charList;
}

/*
    * @param {Object} ctx context Object
    * @param {object} data object for read messages

    */
export let getProjectAndRenderBCTInspViewer = function( ctx, data ) {
    //Reset the context registartion value.
    appCtxService.updateCtx( 'projectToRenderBctComponent', undefined );
    appCtxService.updateCtx( 'selectedSheet', undefined );
    appCtxService.updateCtx( 'bctInspSelection', undefined );
    appCtxService.updateCtx( 'allSelectedBalloons', undefined );
    appCtxService.updateCtx( 'fileTypeOfProject', undefined );
    appCtxService.updateCtx( 'isSelectAllBalloonActive', false );
    appCtxService.updateCtx( 'renderingErrorMessage', undefined );
    appCtxService.updateCtx( 'selectedModelViewName', undefined );
    appCtxService.updateCtx( 'isHideAllBalloonActive', false );
    isPMITabViewSelected = false;
    _mapOfSheetAndSelectedBalloonsOrRows.clear();
    _mapOfSheetAndSelectAllMode.clear();
    _mapOfSheetAndCharacteristics.clear();
    isShowViewChanged = false;
    isDrawingElementRemoved = false;
    modelList = undefined;
    eventBus.publish( 'Acp0.getModelViews' );
    //updating default view on initial loading of drawing
    data.selectedView.dbValue = defaultConstant;
    data.selectedView.uiValue = defaultConstant;
    viewSelected = '';
    pmiBalloonView = '';
    appCtxService.updateCtx( 'selectedModelViewName', data.selectedView.uiValue );
    var renderPart = appCtxService.ctx.selectedPart;
    if ( renderPart ) {
        //Get Project as an input of inspector view to render
        acp0BCTInspUtilService.getPartAttachmentProject( renderPart.uid, data ).then( values => {
            //Make global acess to project object for rendering BCT components
            appCtxService.updateCtx( 'projectToRenderBctComponent', values.project );
            if ( appCtxService.ctx.projectToRenderBctComponent && !appCtxService.ctx.renderingErrorMessage ) {
                var sheetsFromProject = appCtxService.ctx.projectToRenderBctComponent.sheets;
                //Updating sheet and default characteristics map
                for( var i = 0; i < sheetsFromProject.length; i++ ) {
                    _mapOfSheetAndCharacteristics.set( sheetsFromProject[i].name, sheetsFromProject[i].characteristics );
                }
                data.drawingSheetList = listBoxService.createListModelObjects( sheetsFromProject, 'name' );
                appCtxService.updateCtx( 'drawingSheetList', data.drawingSheetList );
                // Validate and return the sheet from which Balloon was imported and want to show on Ui
                var characteristicsIds = appCtxService.ctx.charUidsOfImpPMI;
                if ( characteristicsIds && characteristicsIds.length === 1 && appCtxService.ctx.isActiveTabIdIsPMI ) {
                    var eventData = {
                        sheet: _getImportedBalloonSheetOnListBox( sheetsFromProject, characteristicsIds[0] )
                    };
                    data.acp0DrawingSheetList.dbValue = eventData.sheet;
                    eventBus.publish( 'Acp0.getDrawingSheetList', eventData );
                    //Below code is added to show view specific to imported balloon in PMI tab
                    //K2505 is a key for view description column
                    isPMITabViewSelected = true;
                    var pmiBalloonInfo = values.project.characteristics.find( char => char.id === characteristicsIds[0] );
                    pmiBalloonView = pmiBalloonInfo.props.get( 'K2505' ) !== undefined ? pmiBalloonInfo.props.get( 'K2505' ).toString() : '';
                } else {
                    data.acp0DrawingSheetList.dbValue = sheetsFromProject[0];
                    data.acp0DrawingSheetList.uiValue = sheetsFromProject[0].name;
                    eventBus.publish( 'Acp0.getDrawingSheetList' );
                }
                //Calling components to render
                exports.renderBCTInspViewer( data );
            }
        } );
    }
    return data;
};

/*
   *  This function read the license key and set by calling BCT service setLicensekey function
   *  Currently added as a placeholder in AW5.2 will enhance to read actaull licence key from preference and then send to BCT for validate.
   */
export let readAndSetLicenseKey = function() {
    bctInspectorService.setLicenseKey().then( isLicenseSet => {
        appCtxService.updateCtx( 'isBCTLicenseSet', isLicenseSet );
    } );
};

/*
    * @param {Object} ctx context view model
    * @param {object} data object for read required information
    */
export let renderBCTInspViewer = function( data ) {
    //Based on the view mode calling component to render
    var drawingViewMode = data.i18n.Acp0DrawingViewTitle;
    var tableViewMode = data.i18n.Acp0TableViewTitle;
    var ctx = appCtxService.getCtx();
    var project = ctx.projectToRenderBctComponent;
    if ( project ) {
        var bctInspViewForDrawing = document.getElementById( 'bctInspViewIdForDrawing' );
        var bctDrawingFrameID = document.getElementById( 'bctDrawingFrameID' );
        //Below condition is added to not render drawing again if drawing view mode changes
        if( isShowViewChanged && ( ctx.inspCombineViewMode ||  ctx.inspDrawingViewMode ) && !isDrawingElementRemoved ) {
            bctInspViewForDrawing.style.setProperty( 'display', 'block' );
            bctDrawingFrameID.style.setProperty( 'display', 'block' );
            isShowViewChanged = false;
        } else if ( ctx.inspCombineViewMode ||  ctx.inspDrawingViewMode ) {
            bctInspViewForDrawing.style.setProperty( 'display', 'block' );
            bctDrawingFrameID.style.setProperty( 'display', 'block' );
            bctInspectorViewer = new BctInspectorViewer( bctInspViewForDrawing, self.prepareInspViewComponentInput( project, drawingViewMode, data ) );
            isDrawingElementRemoved = false;
        }
        if ( ctx.inspCombineViewMode || ctx.inspTableViewMode ) {
            var bctInspViewIdForTable = document.getElementById( 'bctInspViewIdForTable' );
            bctInspectorViewer = new BctInspectorViewer( bctInspViewForDrawing, self.prepareInspViewComponentInput( project, drawingViewMode, data ) );
            new BctInspectorViewerTable( bctInspViewIdForTable, self.prepareInspViewComponentInput( project, tableViewMode, data ) );
        }
    }

    // Publish the event to set the BCT viewer height.
    eventBus.publish( 'Acp0.setBctViewerHeight' );
};

/*
   *To select or deselect all the balloons from BCT Inspector View.
    * @param {object} data object for read required information
   */
export let selectDeselectAllBalloonFromInspectorView = function( data ) {
    var selectedCharacteristics = [];
    if ( appCtxService.ctx.selectedSheet ) {
        self.manageVisibilityOfSelectDeselectAllCommand( appCtxService.ctx, true );
        //Get characteristics for perticular view
        var characteristics = appCtxService.ctx.selectedSheet.characteristics;
        //Get already selected characteristics
        if( _mapOfSheetAndSelectedBalloonsOrRows.get( appCtxService.ctx.selectedSheet ) ) {
            selectedCharacteristics = _mapOfSheetAndSelectedBalloonsOrRows.get( appCtxService.ctx.selectedSheet );
        }
        //code to append characteristics in select all mode and remove characteristics in clear all mode
        if( appCtxService.ctx.isSelectAllBalloonActive ) {
            selectedCharacteristics.push.apply( selectedCharacteristics, characteristics );
            //using set to fetch unique values
            selectedCharacteristics = [ ...new Set( selectedCharacteristics ) ];
        } else{
            selectedCharacteristics = selectedCharacteristics.filter( function( val ) {
                return !characteristics.includes( val );
            } );
        }
        _mapOfSheetAndSelectedBalloonsOrRows.set( appCtxService.ctx.selectedSheet, selectedCharacteristics );
        exports.renderBCTInspViewer( data );
    }
};

/*
*To hide or show all the balloons from BCT Inspector View.
 * @param {object} data object for read required information
*/
export let hideAllBalloonsFromInspectorView = function( data ) {
    isShowViewChanged = false;
    var ctx = appCtxService.getCtx();
    if ( ctx.isHideAllBalloonActive ) {
        appCtxService.updateCtx( 'isHideAllBalloonActive', false );
    } else {
        appCtxService.updateCtx( 'isHideAllBalloonActive', true );
    }
    exports.renderBCTInspViewer( data );
};
/*

/*
    * @param {Object} ctx context view model
    * @param {object} data object for read required information
    * @param {string} inspViewMode object for read required information
    */
export let setInspectorViewMode = function( data, inspViewMode ) {
    isShowViewChanged = true;
    appCtxService.updateCtx( 'inspDrawingViewMode', false );
    appCtxService.updateCtx( 'inspTableViewMode', false );
    appCtxService.updateCtx( 'inspCombineViewMode', false );
    switch ( inspViewMode ) {
        case data.i18n.Acp0DrawingViewTitle:
            appCtxService.updateCtx( 'isHideAllBalloonActive', true );
            hideAllBalloonsFromInspectorView( data );
            appCtxService.updateCtx( 'inspDrawingViewMode', true );
            _checkForRenderBCTInspViewer( data );
            break;
        case data.i18n.Acp0TableViewTitle:
            appCtxService.updateCtx( 'isHideAllBalloonActive', false );
            var bctInspViewForDrawing = document.getElementById( 'bctInspViewIdForDrawing' );
            bctInspViewForDrawing.style.setProperty( 'display', 'none' );
            var bctDrawingFrameID = document.getElementById( 'bctDrawingFrameID' );
            bctDrawingFrameID.style.setProperty( 'display', 'none' );
            isDrawingElementRemoved = true;
            appCtxService.updateCtx( 'inspTableViewMode', true );
            _checkForRenderBCTInspViewer( data );
            break;
        default:
            appCtxService.updateCtx( 'isHideAllBalloonActive', true );
            hideAllBalloonsFromInspectorView( data );
            appCtxService.updateCtx( 'inspCombineViewMode', true );
            _checkForRenderBCTInspViewer( data );
    }

    // Publish the event to set the BCT viewer height.
    eventBus.publish( 'Acp0.setBctViewerHeight' );
};

/*
    * @param {object} acp0DrawingSheetList object for read required information
    * @param {object} pmisImportedSheet object PMI imported sheet
    */
export let getDrawingSheetList = function( acp0DrawingSheetList, pmisImportedSheet ) {
    var drawingSheetListToUpdate = appCtxService.ctx.drawingSheetList;
    let newAcp0DrawingSheetList = { ...acp0DrawingSheetList };
    if ( drawingSheetListToUpdate && !pmisImportedSheet ) {
        newAcp0DrawingSheetList.dbValue = drawingSheetListToUpdate[0].propInternalValue;
        newAcp0DrawingSheetList.uiValue = drawingSheetListToUpdate[0].propDisplayValue;
    } else {
        newAcp0DrawingSheetList.dbValue = pmisImportedSheet;
        newAcp0DrawingSheetList.uiValue = pmisImportedSheet.name;
    }

    return { drawingSheetList: drawingSheetListToUpdate, acp0DrawingSheetList: newAcp0DrawingSheetList };
};

/*
    * This method returns the array of updated PMI
    */
export let getUpdatedPMIs = function() {
    return _mUpdatedImportedPMICharUId;
};

/*
    * To manage visibility of select and deselect all toggle command based on sheet selection.
    */
self.manageVisibilityOfSelectDeselectAllCommand = function( cmdClick ) {
    var ctx = appCtxService.getCtx();
    if ( ctx.isSelectAllBalloonActive ) {
        appCtxService.updateCtx( 'isSelectAllBalloonActive', false );
    } else {
        if ( cmdClick || !_mapOfSheetAndSelectedBalloonsOrRows.get( ctx.selectedSheet ) || //
        ctx.selectedSheet.characteristics.length === _mapOfSheetAndSelectedBalloonsOrRows.get( ctx.selectedSheet ).length ) {
            appCtxService.updateCtx( 'isSelectAllBalloonActive', true );
        }
    }
    _mapOfSheetAndSelectAllMode.set( appCtxService.ctx.selectedSheet, appCtxService.ctx.isSelectAllBalloonActive );
    return appCtxService.ctx.isSelectAllBalloonActive;
};

/*
    * @param {Object} project project object
    * @param {string} viewMode string to get mode
    */
self.prepareInspViewComponentInput = function( project, viewMode, data ) {
    var characteristicsIds = appCtxService.getCtx( 'charUidsOfImpPMI' );
    var isSelectEnableMode = characteristicsIds && characteristicsIds.length === 1 && appCtxService.getCtx( 'isActiveTabIdIsPMI' ) ? 'none' : 'multi';
    // Maintain sheet selection in session for rendering components in perticular view mode.
    appCtxService.updateCtx( 'selectedSheet', data.acp0DrawingSheetList ? data.acp0DrawingSheetList.dbValue : appCtxService.getCtx( 'selectedSheet' )
    );
    var selectedSheet = appCtxService.getCtx( 'selectedSheet' );
    var selectedModelViewName = appCtxService.getCtx( 'selectedModelViewName' );

    // ******************Imported and Modified+Imported PMI LIST*********************************
    var updatedImportedPMICharUId = [];
    _mUpdatedImportedPMICharUId = [];
    var characteristicOptionsMap = new Map();

    _mcharOptions.clear();
    var baseRevisionProjectData = appCtxService.getCtx( 'baseRevisionSelection' );
    var baseSelectedPart = appCtxService.getCtx( 'baseSelectedPart' );
    var selectedPart = appCtxService.getCtx( 'selectedPart' );


    if ( characteristicsIds ) {
        //Comparison happened only when Compare Revisions panel is open
        if ( baseRevisionProjectData && selectedPart !== baseSelectedPart ) {
            for ( var characteristic of _mapOfSheetAndCharacteristics.get( selectedSheet.name ) ) {
                if ( characteristicsIds && characteristicsIds.indexOf( characteristic.id ) !== -1/*&& (characteristic.props.get('K2504') === 1 )*/ ) {
                    var check = compareCharacteristic( _returnBaseRevisionChar( baseRevisionProjectData, characteristic ), characteristic );
                    //Fix the coverity issue to avoid dead code
                    if ( !check ) {
                        updatedImportedPMICharUId.push( characteristic.id );
                    }
                }
            }
        }
        characteristicOptionsMap.set( 'imported', characteristicsIds );
        _mUpdatedImportedPMICharUId = updatedImportedPMICharUId;
        updatedImportedPMICharUId.length !== 0  ? characteristicOptionsMap.set( 'importedUpdated', updatedImportedPMICharUId ) : 'Nothing ToDo';
    }
    //*****************Modified Imported PMI LIST**********************************

    appCtxService.updateCtx( 'bctInspSelection', _mapOfSheetAndSelectedBalloonsOrRows.get( selectedSheet ) );
    var overallSelectedBalloons = [];
    var selectedBalloonsFromDifferentSheets =  Array.from( _mapOfSheetAndSelectedBalloonsOrRows.values() );
    for ( var i = 0; i < selectedBalloonsFromDifferentSheets.length; i++ ) {
        for ( var j = 0; j < selectedBalloonsFromDifferentSheets[i].length; j++ ) {
            overallSelectedBalloons.push( selectedBalloonsFromDifferentSheets[i][j] );
        }
    }
    appCtxService.updateCtx( 'allSelectedBalloons', overallSelectedBalloons );

    var propsForRendering = {
        project: project,
        select: isSelectEnableMode,
        onSelectionChange: function( value ) {
            appCtxService.updateCtx( 'bctInspSelection', value );
            _mapOfSheetAndSelectedBalloonsOrRows.set( appCtxService.ctx.selectedSheet, value );
            self.manageVisibilityOfSelectDeselectAllCommand( false );
            exports.renderBCTInspViewer( data );
        },
        onLoad: function( val ) {
            modelList = val;
            eventBus.publish( 'Acp0.getModelViews' );
            if( isPMITabViewSelected ) {
                if( modelList && modelList.modelViews ) {
                    var view = modelList.modelViews.find( vw => vw.name === '"' + pmiBalloonView + '"' );
                    data.selectedView.dbValue = view.id;
                    data.selectedView.uiValue = pmiBalloonView;
                    modelViewChange( data );
                }
                isPMITabViewSelected = false;
                pmiBalloonView = '';
            }
        },
        modelView: viewSelected ? viewSelected : '',
        characteristics: getCharacteristicsFromSelectedView( _mapOfSheetAndCharacteristics.get( selectedSheet.name ) ),
        selected: _mapOfSheetAndSelectedBalloonsOrRows.get( selectedSheet ) || [], //Undefined should not be pass as selected in BCT code undefined means maintain the previous selections.
        balloonsHidden: appCtxService.getCtx( 'isHideAllBalloonActive' ) || false,
        //Prepare characteristic options Map to handle the higlight balloons with different color
        characteristicOptions: characteristicsIds ? _getcharacteristicOptionsMap( characteristicOptionsMap ) : null
    };

    switch ( viewMode ) {
        case data.i18n.Acp0DrawingViewTitle:
            propsForRendering.page = findSheetIndex( project, selectedSheet );
            appCtxService.updateCtx( 'drawingRenderingSheet', selectedSheet );
            appCtxService.updateCtx( 'selectedBalloon', appCtxService.getCtx( 'bctInspSelection' )
            );
            break;
        case data.i18n.Acp0TableViewTitle:
            appCtxService.registerCtx( 'tableRenderingSheet', selectedSheet );
            appCtxService.registerCtx( 'selectedRow', appCtxService.getCtx( 'bctInspSelection' )
            );
            break;
        default:
            //Nothing to do
    }
    return propsForRendering;
};

/**
 * This method finds out the selected sheet index from list of sheets
 * @param {object} project project object
 * @param {object} selectedSheet of project
 * @returns {int} index
 */
function findSheetIndex( project, selectedSheet ) {
    var sheetIndex = -1;
    var found = 0;
    for ( var sheetObj of project.sheets ) {
        if( sheetObj.name === selectedSheet.name ) {
            sheetIndex += 1;
            found = sheetIndex;
            break;
        }
        sheetIndex += 1;
    }
    return found;
}

/**
   * This method checks its actaually need to render BCT inspector or not
   * This requires as drawing or table component lodaded based on sheet selection and selected row and balloon selection.
 * @param {object} data  object
 */
function _checkForRenderBCTInspViewer( data ) {
    exports.renderBCTInspViewer( data );
}

/**
* This method compares characteristics based on property values
* @param {object} fromCharacteristic  object
* @param {object} toCharacteristic  object
* @param {array} fieldIds  list
* @return {boolean} value
 */
function compareCharacteristic( fromCharacteristic, toCharacteristic, fieldIds ) {
    //Required fields for compare
    /**
        * K2101:Nominal Value
        * B2005:Criticality
        * K2112:Lower Tolerance
        * K2113:Upper Tolerance
        * K2142:Unit Of Measure
        * :Sheet Name
        * :X & Y & Z Coordinates
        * :Characteristic Number
       */
    fieldIds = [ 'B2005', 'K2112', 'K2113', 'K2101', 'K2142' ];
    if ( fromCharacteristic ) {
        var fromProps = fromCharacteristic.props;
        var toProps = toCharacteristic.props;
        // As per current requirement given fields are important to check value updation for char spec so avoiding to check prop size difference
        //if ( fromProps.size !== toProps.size ) { return false; }
        for ( var [ key, value ] of fromProps ) {
            if ( fieldIds.includes( key ) && toProps.get( key ) !== value ) {
                console.log( 'key' + key );
                console.log( 'false' + key );
                return false;
            }
        }
    }
    return true;
}

/**
   *This function generates the characteristics option(highlight particular characteristics) to render the components
   * This requires as drawing or table component lodaded based on sheet selection and selected row and balloon selection.
 * @param {string} cssClassName value
 * @param {array} characteristicsIds list
 */
function _getcharacteristicOptions( cssClassName, characteristicsIds ) {
    var charOptionObj = {
        className: [ cssClassName ]
    };
    for ( var characteristicsId of characteristicsIds ) {
        _mcharOptions.set( characteristicsId, charOptionObj );
    }
}

/**
   *This function to iterate characteristics option Map to generate the characteristics option(highlight particular characteristics) to render the components.
 * @param {object} characteristicOptionsMap value
 * @return {object} _mcharOptions
 */
function _getcharacteristicOptionsMap( characteristicOptionsMap ) {
    for ( var characteristicOptions of characteristicOptionsMap.entries() ) {
        _getcharacteristicOptions( characteristicOptions[0], characteristicOptions[1] );
    }
    return _mcharOptions;
}


/**
   *This function to get the sheet from which PMIs are imported.
 * @param {object} sheetsFromProject value
 * @param {object} characteristicsId value
 * @return {object} sheet
 */
function _getImportedBalloonSheetOnListBox( sheetsFromProject, characteristicsId ) {
    for ( var sheet of sheetsFromProject ) {
        for ( var characteristic of sheet.characteristics ) {
            if ( characteristic.id === characteristicsId ) {
                return sheet;
            }
        }
    }
    return;
}

// /*
// * This function to get the Charcteristics from base revision sheet by comapring current rendered sheets charcteristics.
// */
// function _returnBaseRevisionChar(sheetFromBaseRevisionToCompare, characteristic) {
//     for (var baseChar of sheetFromBaseRevisionToCompare.characteristics) {
//         if (baseChar.id === characteristic.id) {
//             return baseChar;
//         }
//     }
//     return;
// }

/**
   *This function to get the Charcteristics from base revision sheet by comapring current rendered sheets charcteristics.
 * @param {object} baseRevisionProjectData value
 * @param {object} characteristic value
 * @return {object} baseChar
 */
function _returnBaseRevisionChar( baseRevisionProjectData, characteristic ) {
    if ( baseRevisionProjectData ) {
        for ( var sheetFromBaseRevisionToCompare of baseRevisionProjectData.sheets ) {
            for ( var baseChar of sheetFromBaseRevisionToCompare.characteristics ) {
                if ( baseChar.id === characteristic.id ) {
                    return baseChar;
                }
            }
        }
    }
    return;
}

/**
   *This function to get the sheet from base revision by comparing current rendered sheet.
 * @param {object} baseRevisionProjectData value
 * @param {object} selectedSheet value
 * @return {object} sheetFromBaseRevisionToCompare
 */
function _returnBaseRevisionSheet( baseRevisionProjectData, selectedSheet ) {
    if ( baseRevisionProjectData ) {
        for ( var sheetFromBaseRevisionToCompare of baseRevisionProjectData.sheets ) {
            if ( sheetFromBaseRevisionToCompare.name === selectedSheet.name ) {
                return sheetFromBaseRevisionToCompare;
            }
        }
    }
    return;
}

/**
   *This function to set the isHideLinkedParts base on "Linked Parts" toggle button
   * It maintain the visibility of the "Linked Parts" panel
 */
export let showHideLinkedPartsPanel = function(  ) {
    var ctx = appCtxService.getCtx();
    if( ctx.isHideLinkedParts ) {
        appCtxService.updateCtx( 'isHideLinkedParts', false );
    }else{
        appCtxService.updateCtx( 'isHideLinkedParts', true );
    }
    // Publish the event to set the BCT viewer height.
    eventBus.publish( 'Acp0.setBctViewerHeight' );
};

export default exports = {
    drawingSheetSelectionChange,
    modelViewChange,
    getModelViews,
    getDrawingSheetList,
    getProjectAndRenderBCTInspViewer,
    readAndSetLicenseKey,
    renderBCTInspViewer,
    selectDeselectAllBalloonFromInspectorView,
    setInspectorViewMode,
    showHideLinkedPartsPanel,
    getUpdatedPMIs,
    hideAllBalloonsFromInspectorView,
    setBctViewerHeight,
    updateBctViewerHeight
};

/**
    * Since this module can be loaded as a dependent DUI module we need to return an object indicating which service
    * should be injected to provide the API for this module.
    */
export let moduleServiceNameToInject = 'Acp0BCTInspCompRenderService';
