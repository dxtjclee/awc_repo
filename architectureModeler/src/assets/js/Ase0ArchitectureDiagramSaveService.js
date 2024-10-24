// Copyright 2021 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 * This implements the graph Diagram Edit handler along with the save features
 * functionalities for Architecture tab
 *
 * @module js/Ase0ArchitectureDiagramSaveService
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import cmm from 'soa/kernel/clientMetaModel';
import notyService from 'js/NotyModule';
import localeService from 'js/localeService';
import editHandlerService from 'js/editHandlerService';
import soaService from 'soa/kernel/soaService';
import leavePlaceService from 'js/leavePlace.service';
import dataSourceService from 'js/dataSourceService';
import archDiagramSaveUtiSvc from 'js/Ase0ArchitectureDiagramSaveUtilSvc';
import archDiagramSVGUtiSvc from 'js/Ase0ArchitectureDiagramSVGUtilService';
import manageDiagramSoaSvc from 'js/Ase0ManageDiagramSoaService';
import aceRestoreBWCStateService from 'js/aceRestoreBWCStateService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import logger from 'js/logger';

let archModelerContext = 'ARCHITECTURE_EDIT_CONTEXT';
let _originalValueOfHasPendingChanges = 0;

let _singleLeaveConfirmation = null;
let _saveTxt = null;
let _discardTxt = null;
let _localizedArchitectureTabName = null;

/**
 *this function register the diagram editHandler called after draw graph and whenever we make change in diagram
 * @param {Object} data data
 * @param {Object} graphState  graphState
 */
export let registerDiagramEditHandler = function( data, graphState ) {
    const graphStateValue = { ...graphState.value };
    if( !data.eventMap['awGraph.itemsAdded'] ) {
        graphStateValue.diagramOpeningComplete = true;
        graphState.update( graphStateValue );
    }
    setEditAndLeaveHandler( data, graphStateValue );
    graphState.update && graphState.update( graphStateValue );
};
/**
 * function to check if AM editHandler is Still Active
 * @returns {boolean} isActive
 */
export let diagramEditHandlerIsActive = function() {
    let isActive = false;
    let activeEditHandler = editHandlerService.getActiveEditHandler();
    let diagramEditHandler = editHandlerService.getEditHandler( archModelerContext );
    if( activeEditHandler && diagramEditHandler && _.isEqual( activeEditHandler, diagramEditHandler ) ) {
        isActive = true;
    }

    return isActive;
};
/**
 * function to check if view mode has been changed in diagramming context
 * @param {Object} graphState graph state
 * @returns {boolean} viewModeChanged
 */
let viewModeChanged = function( graphState ) {
    let viewModeChanged = false;
    let currentView = undefined;
    if( graphState ) {
        currentView = _.get( graphState, 'currentViewMode', undefined );
    }
    let nextView = _.get( appCtxSvc, 'ctx.ViewModeContext.ViewModeContext', undefined );
    if( nextView && currentView !== nextView ) {
        viewModeChanged = true;
    }
    return viewModeChanged;
};

/**
 *load the message from message bundle
 */
let loadConfirmationMessage = function() {
    if( localeService && !_singleLeaveConfirmation && !_saveTxt && !_discardTxt ) {
        localeService.getTextPromise( 'ArchitectureModelerMessages' ).then(
            function( messageBundle ) {
                _singleLeaveConfirmation = messageBundle.leaveDiagramConfirmation;
            } );
        localeService.getTextPromise( 'ArchitectureModelerConstants' ).then(
            function( constBundle ) {
                _saveTxt = constBundle.save;
                _discardTxt = constBundle.discard;
                _localizedArchitectureTabName = constBundle.architectureModelerPageTitle;
            } );
    }
};

//clean and reset vars after save or cancel.
let cleanup = function( graphState ) {
    _originalValueOfHasPendingChanges = 0;
    if( graphState ) {
        graphState.hasPendingChanges = false;
        graphState.hasPendingChangesInDiagram = false;
    }
    exports.removeEditAndLeaveHandler();
};

let updateViewMode = function() {
    let viewMode = _.get( appCtxSvc, 'ctx.ViewModeContext.ViewModeContext', undefined );
    if( viewMode ) {
        return viewMode;
    }
};

let isSwitchingToAnotherTabWithinACE = function( subPanelContext, oldState, newState ) {
    let leavingArchitecture = false;
    if( oldState && newState ) {
        let newSpageId = _.get( newState, 'params.spageId', undefined );
        let oldSpageId = _.get( oldState, 'params.spageId', undefined );
        if( newSpageId && oldSpageId && newSpageId !== undefined && oldSpageId !== undefined
            && newSpageId !== oldSpageId && ( newSpageId !== 'Architecture' && newSpageId !== 'Ase0ArchitectureFeature' ) ) {
            leavingArchitecture = true;
        }
    } else {
        let newTabName = _.get( subPanelContext, 'activeTab.name', undefined );
        if( newTabName && newTabName !== _localizedArchitectureTabName && newTabName !== 'Ase0ArchitectureFeature' ) {
            leavingArchitecture = true;
        }
    }
    return leavingArchitecture;
};

let shouldShowPopup = function( targetNavDetails, oldState, newState, graphState, subPanelContext ) {
    let mustShowPopUp = false;

    if( graphState && diagramEditInProgress( graphState ) && targetNavDetails ) {
        let oldUid = _.get( subPanelContext, 'context.occContext.previousState.uid', undefined );
        let newUid = _.get( newState, 'params.uid', undefined );
        let targetPath = _.get( targetNavDetails, 'targetPath', undefined );

        if( newState ) {
            if( !targetPath ) {
                targetPath = _.get( newState, 'state.name', undefined );
            }
        } else {
            if( !targetPath ) {
                targetPath = _.get( targetNavDetails, 'toState.name', undefined );
            }
        }
        if( targetPath && targetPath !== 'com_siemens_splm_clientfx_tcui_xrt_showObject' ||
            newUid && oldUid && oldUid !== newUid ) {
            mustShowPopUp = true;
        }
    }
    return mustShowPopUp;
};
let setEditAndLeaveHandler = function( data, graphState ) {
    let dataSource = dataSourceService.createNewDataSource( {
        declViewModel: {
            data: data,
            graphState: graphState
        }
    } );

    let startEditFunc = function() {
        // function that returns a promise.
        let deferred = AwPromiseService.instance.defer();

        deferred.resolve( {} );
        return deferred.promise;
    };

    //create Edit Handler
    let editHandler = createEditHandler( dataSource, startEditFunc );
    //registerEditHandler
    if( editHandler ) {
        editHandlerService.setEditHandler( editHandler, archModelerContext );
        editHandlerService.setActiveEditHandlerContext( archModelerContext );
        editHandler.startEdit();
    }
};

/**
 * Remove Edit Handler and unregister LEave Handler
 */
export let removeEditAndLeaveHandler = function() {
    editHandlerService.removeEditHandler( archModelerContext );
};
/**
 *
 * @param {Object} dataSource    dataSource
 * @param {Object} startEditFunction startEdit function
 * @returns {Object} editHandler editHandler
 */
let createEditHandler = function( dataSource, startEditFunction ) {
    let editHandler = {
        // Mark this handler as native -
        isNative: true,
        _editing: false
    };
    editHandler.getEditHandlerContext = function() {
        return archModelerContext;
    };
    let _startEditFunction = startEditFunction; // provided function refs for start/save.

    /**
     * @param {String} stateName - edit state name ('starting', 'saved', 'cancelling')
     */
    function _notifySaveStateChanged( stateName ) {
        let context = {
            state: stateName
        };
        if( dataSource ) {
            switch ( stateName ) {
                case 'starting':
                    break;
                case 'saved':
                    dataSource.saveEditiableStates();
                    break;
                case 'canceling':
                    dataSource.resetEditiableStates();
                    break;
                default:
                    logger.error( 'Unexpected stateName value: ' + stateName );
            }
            context.dataSource = dataSource.getSourceObject();
        }
        editHandler._editing = stateName === 'starting';

        // Add to the appCtx about the editing state
        appCtxSvc.updateCtx( 'editInProgress', editHandler._editing );
        eventBus.publish( 'editHandlerStateChange', context );
    }
    /*Start editing*/
    editHandler.startEdit = function() {
        let defer = AwPromiseService.instance.defer();
        _startEditFunction().then( function( response ) {
            _notifySaveStateChanged( 'starting' );
            defer.resolve( response );
        }, function( err ) {
            defer.reject( err );
        } );

        //Register with leave place service
        leavePlaceService.registerLeaveHandler( {
            okToLeave: function( targetNavDetails, oldState, newState ) {
                return editHandler.leaveConfirmation2( targetNavDetails, oldState, newState );
            }
        } );

        return defer.promise;
    };
    /**
     * Can we start editing?
     *
     * @return {Boolean} true if we can start editing
     */
    editHandler.canStartEdit = function() {
        return dataSource.canStartEdit();
    };
    /**
     * Is an edit in progress?
     *
     * @return {Boolean} true if we're editing
     */
    editHandler.editInProgress = function() {
        return editHandler._editing;
    };
    /**
     *
     * @param {boolean} noPendingModifications  pending Notifications
     */
    editHandler.cancelEdits = function( noPendingModifications ) {
        let graphState;
        if( dataSource && dataSource.getDeclViewModel() ) {
            let vmData = dataSource.getDeclViewModel();
            graphState = vmData.graphState;
        }
        if( noPendingModifications ) {
            _notifySaveStateChanged( 'canceling' );
            cleanup( graphState );
        }
    };
    /*Save Edits*/
    editHandler.saveEdits = function() {
        let deffer = AwPromiseService.instance.defer();
        let graphState;
        let occContext;
        let graphModel;
        let legendState;
        if( dataSource && dataSource.getDeclViewModel() ) {
            let vmData = dataSource.getDeclViewModel();
            graphState = vmData.graphState;
            occContext = vmData.data.subPanelContext.context.occContext;
            graphModel = vmData.data.graphModel;
            legendState = vmData.data.ctx.graph.legendState;
        }
        if( exports.isWorkingContextTypeDiagram( occContext ) ) {
            let promise = saveDiagramAsync( graphState, occContext, graphModel, legendState );
            promise.then( function() {
                // logger.info( "saveDiagram Completed" );
                if( graphState ) {
                    graphState.hasPendingChanges = false;
                }
                deffer.resolve();
            } )
                .catch( function( error ) {
                    deffer.reject( error );
                } );
        }
        cleanup( graphState );
        return deffer.promise;
    };

    /*Check if diagram IS Dirty */
    editHandler.isDirty = function() {
        let deferred = AwPromiseService.instance.defer();
        let graphState;
        if( dataSource && dataSource.getDeclViewModel() ) {
            let vmData = dataSource.getDeclViewModel();
            graphState = vmData.graphState;
        }
        let isDirty = diagramEditInProgress( graphState );
        deferred.resolve( isDirty );
        return deferred.promise;
    };

    /**
     *
     * @param {String} label button label
     * @param {AsyncFUnction} callback callBack
     * @returns {Object} button Object
     */
    function createButton( label, callback ) {
        return {
            addClass: 'btn btn-notify',
            text: label,
            onClick: callback
        };
    }
    editHandler.getDataSource = function() {
        return dataSource;
    };

    editHandler.destroy = function() {
        dataSource = null;
    };
    //message Showing as Popup
    let displayNotificationMessage = function( occContext ) {
        //If a popup is already active just return existing promise
        let message = _singleLeaveConfirmation;
        let openedObjectName = getOpenedObjectName( occContext );

        if( openedObjectName ) {
            message = _singleLeaveConfirmation.replace( '{0}', openedObjectName );
        }
        if( !editHandler._deferredPopup ) {
            editHandler._deferredPopup = AwPromiseService.instance.defer();
        }

        let buttonArray = [];
        buttonArray.push( createButton( _saveTxt, function( $noty ) {
            $noty.close();
            editHandler.saveEdits().then( function() {
                editHandler._deferredPopup.resolve();
                editHandler._deferredPopup = null;
                //incase of error
            }, function() {
                editHandler._deferredPopup.resolve();
                editHandler._deferredPopup = null;
            } );
        } ) );
        buttonArray.push( createButton( _discardTxt, function( $noty ) {
            $noty.close();
            editHandler.cancelEdits();
            editHandler._deferredPopup.resolve();
            editHandler._deferredPopup = null;
        } ) );

        notyService.showWarning( message, buttonArray );

        return editHandler._deferredPopup.promise;
    };

    /**
     *   this is editHandler leaveConfirmation in which call comes for editHandlerService
     *   if viewMode Has been Changed to any of the summary view to Non summary view then directly show the PopUp
     *
     *   @param {Object} callback callBack Function
     *   @returns {leaveConfirmation}  promise Object
     */
    editHandler.leaveConfirmation = function( callback ) {
        let graphState;
        let subPanelContext;
        let graphModel;
        let legendState;
        if( dataSource && dataSource.getDeclViewModel() ) {
            let vmData = dataSource.getDeclViewModel();
            graphState = vmData.graphState;
            subPanelContext = vmData.data.subPanelContext;
            graphModel = vmData.data.graphModel;
            legendState = vmData.data.ctx.graph.legendState;
        }
        //update if call made By ViewMode Change
        if( viewModeChanged( graphState ) ) {
            let showPopUpViewChange = false;
            let nextView = _.get( appCtxSvc, 'ctx.ViewModeContext.ViewModeContext', undefined );
            //switching to non Summary view
            if( !( nextView === 'SummaryView' || nextView === 'TableSummaryView' || nextView === 'TreeSummaryView' ) ) {
                showPopUpViewChange = true;
                // [ LCS-211486 ] unregister editInProgress when switching to non Summary view
                appCtxSvc.unRegisterCtx( 'editInProgress' );
            }

            return leaveConfirmation( callback, showPopUpViewChange, graphState, subPanelContext, graphModel, legendState );
        }
        let showPopUp = false;
        // Check if we are switching to another tab from Architecture tab
        showPopUp = isSwitchingToAnotherTabWithinACE( subPanelContext, null, null );
        return leaveConfirmation( callback, showPopUp, graphState, subPanelContext, graphModel, legendState );
    };
    /*this leave confirmation is for  identifying the call made form leavePlace.service.js*/
    editHandler.leaveConfirmation2 = function( targetNavDetails, oldState, newState ) {
        let showPopUp = false;
        let graphState;
        let subPanelContext;
        let graphModel;
        let legendState;
        if( dataSource && dataSource.getDeclViewModel() ) {
            let vmData = dataSource.getDeclViewModel();
            graphState = vmData.graphState;
            subPanelContext = vmData.data.subPanelContext;
            graphModel = vmData.data.graphModel;
            legendState = vmData.data.ctx.graph.legendState;
        }

        // Check if we are switching to another tab from Architecture tab
        showPopUp = isSwitchingToAnotherTabWithinACE( subPanelContext, oldState, newState );
        if( showPopUp ) {
            return leaveConfirmation( null, showPopUp, graphState, subPanelContext, graphModel, legendState );
        }
        showPopUp = shouldShowPopup( targetNavDetails, oldState, newState, graphState, subPanelContext );
        return leaveConfirmation( null, showPopUp, graphState, subPanelContext, graphModel, legendState );
    };
    /**
     * This is the common code of leaveConfirmation
     * if diagram is dirty
     *  then if popUp is to be shown
     *      display PopUp
     *      else
     *         increment the counter processCallback and update the diagramming cache value
     * else
     *      if we are not in diagramming context and structure is dirty
     *      then save Diagram(auto bookmark) i e leaving the structure then save it.
     *      update the cache and process callback
     * return promise
     * @param {Object} callback callBack Function
     * @param {Boolean} showPopUp showPopUp
     * @param {Object} graphState graphState
     * @param {Object} subPanelContext Sub Panel Context
     * @param {Object} graphModel graphModel
     * @param {Object} legendState legendState
     * @returns {deferred.promise}  promise Object
     */
    let leaveConfirmation = function( callback, showPopUp, graphState, subPanelContext, graphModel, legendState ) {
        let deferred = AwPromiseService.instance.defer();
        let occContext;
        if( subPanelContext && subPanelContext.context && subPanelContext.context.occContext ) {
            occContext = subPanelContext.context.occContext;
        }
        if( graphState && diagramEditInProgress( graphState ) ) {
            if( showPopUp ) {
                displayNotificationMessage( occContext ).then( function() {
                    processCallBack( callback );
                    deferred.resolve();
                } );
            } else {
                ++_originalValueOfHasPendingChanges;
                deferred.resolve();
                processCallBack( callback );
            }
        } else {
            if( !exports.isWorkingContextTypeDiagram( occContext ) && graphState &&
                _.get( graphState, 'hasPendingChanges', false ) ) {
                saveDiagram( null, graphState, graphModel, legendState );
            }
            editHandler.cancelEdits( true );
            deferred.resolve();
            processCallBack( callback );
        }
        return deferred.promise;
    };

    return editHandler;
};

/**
 *Handle the callback function which has been came in leaveConfirmation
    if call back is a valid callback
    then call callback.
    if leaveConfirmCounter is more than 2 then reset the leaveConfirmBySelectionChange to zero.
    since in case of selection change call comes to leaveConfirmation twice
    we fire events so that edit handler remain register in diagramming context since leave handler is unregistered after some time
 * @param {function} callback callback function to be processed
 */
let processCallBack = function( callback ) {
    if( callback && _.isFunction( callback ) ) {
        callback();
    }
    if( _originalValueOfHasPendingChanges >= 2 ) {
        _originalValueOfHasPendingChanges = 0;
        _.defer( function() {
            eventBus.publish( 'AMDiagram.Modified', {} );
        } );
    }
};
/**
 * @param {Object} graphState graphState
 * @return {Boolean} true if diagram is Dirty or we are editing the diagram
 */
let diagramEditInProgress = function( graphState ) {
    if( graphState ) {
        return _.get( graphState, 'hasPendingChangesInDiagram', false );
    }
    return false;
};
/**
 *set the hasPendingChange in ctx.
 * @param {boolean}  hasPendingChanges  to context
 * @param {Object} graphState graphState
 */
export let setHasPendingChange = function( hasPendingChanges, graphState ) {
    const graphStateValue = { ...graphState.value };
    graphStateValue.hasPendingChanges = hasPendingChanges;
    //Since save diagram completed by now,process save working Context if case of explicit save
    if( !hasPendingChanges && graphState.isExplicitSaveDiagram &&
        diagramEditInProgress( graphState ) ) {
        //also update save working context. only for the case of Save Diagram One-step Command.
        eventBus.publish( 'AMGraphEvent.updateSavedWorkingContext', {} );
        //cleanup after explicit save.
        cleanup( graphStateValue );
    }
    graphState.update && graphState.update( graphStateValue );
};
/**
 *mark dirty flag in arch ctx.
 * @param {boolean}  hasPendingChangesInDiagram  set to graphState
 * @param {Object}  graphState  set hasPendingChangesInDiagram to graphState
 */
export let setHasPendingChangeInDiagram = function( hasPendingChangesInDiagram, graphState ) {
    const graphStateValue = { ...graphState.value };
    graphStateValue.hasPendingChangesInDiagram = hasPendingChangesInDiagram;
    if( !graphStateValue.hasPendingChangesInDiagram ) {
        graphStateValue.isExplicitSaveDiagram = false;
    }
    graphState.update && graphState.update( graphStateValue );
};
/**
 *on specific event from graph viewModel diagram is marked dirty.
if diagram/structure opening has done
    if Structure has change
        then hasPendingChange to true in diagramming ctx
            if we are in diagrammingContext
            then subscribe home back,advance search listener,register editHandler,
            update cache disable checkOutCommand
 * @param {boolean} hasPendingChanges flag is set To ctx
 * @param {Object} occContext occ Context
 * @param {Object} graphState graph State
 * @param {Object} data data
 */
export let markDiagramAsDirty = function( hasPendingChanges, occContext, graphState, data ) {
    //going to start save Diagram
    const graphStateValue = { ...graphState.value };
    let diagramOpeningComplete = _.get( graphState, 'diagramOpeningComplete', false );
    if( diagramOpeningComplete && hasPendingChanges ) {
        graphStateValue.hasPendingChanges = hasPendingChanges;
        //in case of  diagramming Context of graph Item
        if( exports.isWorkingContextTypeDiagram( occContext ) ) {
            graphStateValue.hasPendingChangesInDiagram = hasPendingChanges;
            loadConfirmationMessage();
            setEditAndLeaveHandler( data, graphStateValue );
            let viewMode = updateViewMode();
            if( viewMode ) {
                graphStateValue.currentViewMode = viewMode;
            }
        }
    }
    if( !diagramOpeningComplete ) {
        graphStateValue.diagramOpeningComplete = true;
    }
    if ( !graphState.isModelChangeDueToOpenDiagram ) {
        // The root product is not yet interacted during the session
        // And we are trying to interact with diagram, that we have make sure product is added into session cache by publishing occMgmt.interaction event.
        // Please note ACE is taking care of all other interactions happen by commands.
        if ( occContext && occContext.currentState &&
            !aceRestoreBWCStateService.isProductInteracted( occContext.currentState.uid ) ) {
            eventBus.publish( 'occMgmt.interaction' );
        }
    } else {
        graphStateValue.isModelChangeDueToOpenDiagram = false;
    }

    graphState.update && graphState.update( graphStateValue );
};

/**
 *   get Diagramming Context
 * @param {Object} occContext OccManagement Context
 * @returns {boolean} isDiagrammingContext
 */
export let isWorkingContextTypeDiagram = function( occContext ) {
    let workingContext = getDiagramWorkingContext( occContext );
    return workingContext && cmm.isInstanceOf( 'Ase0Diagram', workingContext.modelType );
};

/**
 * Save Diagram In BookMark Only
 * @param {Object} graphState graphState
 * @param {Object} graphModel graphModel
 * @param {Object} legendState legendState
 */
export let saveDiagramInAutoBookMarkOnly = function( graphState, graphModel, legendState ) {
    const graphStateValue = { ...graphState.value };
    if( _.get( graphState, 'hasPendingChanges', false ) ) {
        saveDiagram( null, graphState, graphModel, legendState );
    }
    graphState.update && graphState.update( graphStateValue );
};

//Function that replaces the <use> with the actual SVG DOM that <use> is referencing
let diagramExportingEvtHandler = function( args ) {
    let svgRoot = args.getDomElement();
    //adding below logic to move the SDF_printDiv dom generated as part of raster comversion inside
    //main canvas so that the hierarchical is applied to it properly.

    let SDF_printDiv = document.getElementById( 'SDF_printDiv' );
    let wrapper = document.querySelectorAll( '[data-sdf-id=\'SDF_canvasWrapper\']' );
    if( wrapper && wrapper.length > 0 ) {
        let graphContainer = wrapper[ 0 ].parentElement;
        graphContainer.append( SDF_printDiv );
    }

    //#endregion
    let graphModel = appCtxSvc.ctx.graph.graphModel;
    if( svgRoot && !_.isEmpty( svgRoot.outerHTML ) ) {
        let boundaries = null;
        if( graphModel && graphModel.graphControl ) {
            let graphControl = graphModel.graphControl;
            let graph = graphControl.graph;
            if( graph ) {
                boundaries = graph.getVisibleBoundaries();
                archDiagramSVGUtiSvc.processBoundaries( svgRoot, boundaries );
            }
        }
        archDiagramSVGUtiSvc.processStyleTags( svgRoot );
    }
};

/**
 * This function perform the manual save diagram from Save Diagram Command
 * also it also export the preview of Diagram.
 *
 * @param {Object} graphModel graph model
 * @param {Object} graphState graph state,
 * @param {Object} legendState legendState
 */
export let manualSaveDiagram = function( graphModel, graphState, legendState ) {
    const graphStateValue = { ...graphState.value };
    if( graphModel && graphModel.graphControl ) {
        let graphControl = graphModel.graphControl;
        let sheetBounds = graphControl.getSheetBounds();

        let width = sheetBounds.width * 1.5;
        let height = sheetBounds.height * 1.5;

        let diagramExportControl = graphControl.createExportControl();
        diagramExportControl.topLeftOrigin = true;
        diagramExportControl.allSheetElements = true;
        diagramExportControl.graphSize = [ width, height ];
        diagramExportControl.fireDiagramExportingEvent = true;
        let imagesPath = [];

        let svgString = graphControl.exportGraphAsString( diagramExportControl, diagramExportingEvtHandler );

        if( !_.isEmpty( svgString ) ) {
            let parser = new DOMParser();
            let svgRoot = parser.parseFromString( svgString, 'text/html' );
            if( svgRoot ) {
                imagesPath = archDiagramSVGUtiSvc.getImagesIconElement( svgRoot );

                archDiagramSVGUtiSvc.getImageSvgContent( imagesPath ).then( function( data ) {
                    let imgPreviewSvgStr;

                    try {
                        imgPreviewSvgStr = archDiagramSVGUtiSvc.processUseTag( svgRoot, data );
                        imgPreviewSvgStr = imgPreviewSvgStr.replace( /&nbsp;/g, '&#160;' );
                    } catch ( ex ) {
                        logger.error( 'Error:' + ex.message );
                    } finally {
                        if( imgPreviewSvgStr && !_.isEmpty( imgPreviewSvgStr ) ) {
                            let saveDiagramPreviewInfo = {
                                svgString: imgPreviewSvgStr,
                                width: String( width ),
                                height: String( height )
                            };
                            exports.saveDiagramAndUpdateWorkingContext( saveDiagramPreviewInfo, graphStateValue, graphModel, legendState );
                            graphState.update( graphStateValue );
                        } else {
                            exports.saveDiagramAndUpdateWorkingContext( null, graphStateValue, graphModel, legendState );
                            graphState.update( graphStateValue );
                        }
                    }
                } );
            }
        } else {
            exports.saveDiagramAndUpdateWorkingContext( null, graphStateValue, graphModel, legendState );
            graphState.update( graphStateValue );
        }
    }
};

/**
 * @param{string} opts optional param required for preview
 * @param {Object} graphState graphState
 * @param {Object} graphModel graphModel
 * @param {Object} legendState legendState
 * this function save diagram and updateWorkingContext
 */
export let saveDiagramAndUpdateWorkingContext = function( opts, graphState, graphModel, legendState ) {
    if( diagramEditInProgress( graphState ) ) {
        graphState.isExplicitSaveDiagram = true;
        if( opts && !_.isEmpty( opts.svgString ) ) {
            saveDiagram( opts, graphState, graphModel, legendState );
        } else {
            saveDiagram( null, graphState, graphModel, legendState );
        }
    }
};

/** Diagram context
 * @param {Object} occContext OccManagement Context
 *@returns {object}  savedWorkingContext  savedWorking Context
 */
let getDiagramWorkingContext = function( occContext ) {
    let savedWorkingContext = null;
    if( occContext && occContext.workingContextObj ) {
        savedWorkingContext = occContext.workingContextObj;
    }
    return savedWorkingContext;
};

/**
 * @param {string} opts preview string
 * @param {Object} graphState graphState
 * @param {Object} graphModel graphModel
 * @param {Object} legendState legendState
 * Save Diagram
 */
let saveDiagram = function( opts, graphState, graphModel, legendState ) {
    eventBus.publish( 'AMManageDiagramEvent', getSaveDiagramData( opts, graphState, graphModel, legendState ) );
};

/**
 * Get complete the Diagram info present on canvas
 *@param {string} opts svg string
 *@param {Object} graphState graphState
 *@param {Object} graphModel graphModel
 *@param {Object} legendState legendState
 *@returns {Object} eventData
 */
let getSaveDiagramData = function( opts, graphState, graphModel, legendState ) {
    let diagramInfoObj = archDiagramSaveUtiSvc.getOpenedDiagramInfo( graphState, graphModel, legendState );
    let objectsToSave = diagramInfoObj.objectsToSave;
    let objectsToHide = diagramInfoObj.objectsToHide;
    let diagramInfo = diagramInfoObj.diagramInfo;
    let isExplicitSaveDiagram;
    if( graphState ) {
        isExplicitSaveDiagram = graphState.isExplicitSaveDiagram;
    }
    if( isExplicitSaveDiagram ) { diagramInfo.isExplicitSaveDiagram = [ isExplicitSaveDiagram.toString() ]; }
    if( opts && !_.isEmpty( opts.svgString ) ) {
        diagramInfoObj.diagramInfo.previewInfo = [ opts.svgString ];
        diagramInfoObj.diagramInfo.previewHeight = [ opts.height ];
        diagramInfoObj.diagramInfo.previewWidth = [ opts.width ];
    }

    return {
        userAction: 'SaveDiagram',
        primaryObjects: objectsToSave,
        secondaryObjects: objectsToHide,
        diagramInfo: diagramInfo
    };
};
/**
 *save diagram from confirmation dialogue on selection of Save
 @param {Object} graphState graphState
 @param {Object} occContext occManagement Context
 @param {Object} graphModel graphModel
 @param {Object} legendState legendState
 @returns {Object}  promise
 */
let saveDiagramAsync = function( graphState, occContext, graphModel, legendState ) {
    let saveDiagramData = getSaveDiagramData( null, graphState, graphModel, legendState );
    let manageDiagramQue = [];
    let activeView;
    if( legendState && legendState.activeView ) {
        activeView = legendState.activeView;
    }
    let deferred = AwPromiseService.instance.defer();
    let manageDiagramInput = { input: manageDiagramSoaSvc.getManageDiagram2Input( saveDiagramData, manageDiagramQue, graphModel, occContext, activeView ) };
    let promise = soaService.post( 'Internal-ActiveWorkspaceSysEng-2017-06-DiagramManagement',
        'manageDiagram2', manageDiagramInput );

    promise.then( function() {
        //Reset HasPendingChange
        if( graphState ) {
            graphState.hasPendingChanges = false;
        }
        //call update saveBookMark
        updateSavedBookMark( graphState, occContext ).then( function() {
            deferred.resolve();
        } ).catch( function( error ) {
            deferred.reject( error );
        } );
    } )
        .catch( function( error ) {
            deferred.reject( error );
        } );
    return deferred.promise;
};

let updateSavedBookMark = function( graphState, occContext ) {
    let deferred = AwPromiseService.instance.defer();
    if( exports.isWorkingContextTypeDiagram( occContext ) ) {
        let inputData = { savedBookmarkObjects: [ occContext.workingContextObj ] };
        let promise = soaService.post( 'Internal-ActiveWorkspaceBom-2012-10-OccurrenceManagement',
            'updateSavedBookmark', inputData );
        promise.then( function() {
            //Reset HasPendingChangeInDiagram and counter
            _originalValueOfHasPendingChanges = 0;
            if( graphState ) {
                const graphStateValue = { ...graphState.value };
                graphStateValue.hasPendingChangesInDiagram = false;
                graphState.update( graphStateValue );
            }
            deferred.resolve();
        } ).catch( function( error ) {
            deferred.reject( error );
        } );
    } else {
        deferred.resolve();
    }

    return deferred.promise;
};

/**
 * update the diagram Object name that is needed to show in confirmation message
 * @param {Object} occContext occManagement Context
 * @returns {String} openedObjectName opened object name
 */
let getOpenedObjectName = function( occContext ) {
    let openedObjectName;
    if( occContext && occContext.workingContextObj && occContext.workingContextObj.props && occContext.workingContextObj.props.object_string ) {
        openedObjectName = occContext.workingContextObj.props.object_string.uiValues[ 0 ];
    }
    return openedObjectName;
};

const exports = {
    registerDiagramEditHandler,
    diagramEditHandlerIsActive,
    removeEditAndLeaveHandler,
    setHasPendingChange,
    setHasPendingChangeInDiagram,
    markDiagramAsDirty,
    isWorkingContextTypeDiagram,
    saveDiagramInAutoBookMarkOnly,
    manualSaveDiagram,
    saveDiagramAndUpdateWorkingContext
};
export default exports;
