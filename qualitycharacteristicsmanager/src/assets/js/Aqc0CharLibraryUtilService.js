// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service called.
 *
 *
 * @module js/Aqc0CharLibraryUtilService
 */
import addObjectUtils from 'js/addObjectUtils';
import uwPropertyService from 'js/uwPropertyService';
import eventBus from 'js/eventBus';
import navigationSvc from 'js/navigationService';
import appCtxService from 'js/appCtxService';
import aqc0CharLibTree from 'js/Aqc0CharLibraryTreeTableService';
import commandsSvc from 'js/command.service';
import localeService from 'js/localeService';
import messagingSvc from 'js/messagingService';
import AwPromiseService from 'js/awPromiseService';

var exports = {};
export let getObjCreateInfoDataProcessing = function( selectedType, editHandler ) {
    var objCreateInfo = addObjectUtils.getObjCreateInfo( selectedType, editHandler );
    var inEditMode = true;
    var processObjInfo = {};
    if ( objCreateInfo && objCreateInfo.props ) {
        objCreateInfo.props.forEach( ( vmProp ) => {
            if ( vmProp ) {
                var valStr = uwPropertyService.getValueStrings( vmProp );
                if ( valStr && valStr.length > 0 ) {
                    var val = valStr[0];
                    if ( ( val === true || val !== 'null' && val && val.length > 0 ) &&
                        ( !inEditMode || vmProp.isEditable ) ) {
                        {
                            processObjInfo[vmProp.propertyName] = val.toString();
                        }
                    }
                }
            }
        } );
    }

    return processObjInfo;
};

/**
* Method to add recent created object to location State Object and updae
* @param {Object} createdObject created object
* @param {Object} searchState search/showobject location info object
* @param {object} pinUnpinnedFlag represent pin/unpin panel status
*/
export let addPanelObjectCreated = function( createdObject, subPanelContext, pinUnpinnedFlag ) {
    let searchState = subPanelContext.searchState ? subPanelContext.searchState : subPanelContext.pageContext.sublocationState;
    appCtxService.updateCtx( 'charLibmanagercontext.parentElement', createdObject.props.qc0GroupReference );
    if( searchState ) {
        let searchData = { ...searchState.value };
        searchData.newlyCreatedObjectFromCharLib = createdObject;
        searchData.pinUnpinnedFlag = pinUnpinnedFlag;
        searchState.update( { ...searchData } );
    }

    // regression  - LCS-765045 - Need to refresh the page to see newly added CG/NC/Rule in pin mode
    //code is added to show newly added element in PWA when panel is pinned
    if( pinUnpinnedFlag ) {
        eventBus.publish( 'primaryWorkarea.reset' );
    }
};

/**
* Execute a command with the given arguments
*
* @param {String} commandId - Command id
* @param {String|String[]} commandArgs -
* @param {Object} commandContext - command context
*/
export let renderEditViewForObjects = function( viewModeContext, commandActionExecutor ) {
    //TODO: executeCommand requires the "runActionWithViewModel" API which is only accessible from render function
    // commandsSvc.executeCommand( commandId, commandArgs, null, commandContext );
    // revisit when investigating all the usages of executeCommand
    //var viewMode = appCtxSvc.ctx.ViewModeContext.ViewModeContext;
    //var executeCommandId = viewMode === 'TreeSummaryView' ? 'Awp0StartEditSummary' : 'Awp0StartEdit';
    let commandActionExecutorData = { ...commandActionExecutor.value };
    commandsSvc.executeCommand( 'Awp0StartEdit', null, null, null, commandActionExecutorData.runActionWithViewModel );
};

/**
 * Execute all post event or actions afeter Char spec version
 * @param {Object} createdObject - created Object
 * @param {Object} subPanelContext - sub Panel Context
 * @param {boolean} removeActionflag
 */
export let executePostVersionEventActionsForSpecifications = function( createdObject, subPanelContext, removeOrEditActionflag, pinUnpinnedFlag ) {
    // Tree View Specific in Characteristic Library
    let ViewModeContextCtx = appCtxService.getCtx( 'ViewModeContext' );
    // To fix the issue LCS-613225: Characteristic loses selection after version, same is the case with Failure Specification. This issue is because ViewModeContext was not accesible directly.
    //if ( ViewModeContextCtx && ViewModeContextCtx.ViewModeContext === 'TreeSummaryView' ) {
    // To fix the issue LCS-716645 Characteristic Group does not show expand button in Characteristic library whenever we try to add child and go back and select "Tree with Summary" mode .
    aqc0CharLibTree.clearMapOfCharGroupAndSpecification();
    // }
    //Characteristic Specification open(showObjectLocation) location check
    !subPanelContext.openedObject ? exports.addPanelObjectCreated( createdObject, subPanelContext, pinUnpinnedFlag ) : 'no state updation required';
    //Characteristic Specification open(showObjectLocation) location check
    if ( subPanelContext.openedObject !== undefined && subPanelContext.openedObject.modelType.typeHierarchyArray.indexOf( 'Qc0MasterCharSpec' ) > -1 ) {
        var commandId = 'Awp0ShowObject';
        var commandArgs = {
            edit: false
        };
        var commandContext = {
            vmo: createdObject
        };
        //TODO: executeCommand requires the "runActionWithViewModel" API which is only accessible from render function
        // commandsSvc.executeCommand( commandId, commandArgs, null, commandContext );
        // revisit when investigating all the usages of executeCommand
        //aqc0CharManagerUtils.openNewObject(commandId, commandArgs, commandContext);
        var navigationParams = {
            uid: commandContext.vmo.uid,
            edit: commandArgs.edit ? commandArgs.edit.toString() : commandArgs.edit
        };
        var action = {
            actionType: 'Navigate',
            navigateTo: 'com_siemens_splm_clientfx_tcui_xrt_showObject'
        };
        navigationSvc.navigate( action, navigationParams );
    }
    //Close the Panel
    if ( !removeOrEditActionflag && !pinUnpinnedFlag ) {
        eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );
    }
};

/**
 * To navigate between the panels
 * @param {Object} commandContext - context
 * @param {String} nextActiveView - Active view value
 */
export let switchPanelsCharManager = ( commandContext, nextActiveView, selectedCharGrouptobeNavigate, selectedSpecificationObject ) => {
    let sharedData = commandContext.sharedData;
    let newsharedData = { ...sharedData.value };
    newsharedData.activeView = nextActiveView;
    newsharedData.selectedCharGroup = selectedCharGrouptobeNavigate;
    newsharedData.selectedSpecificationObject = selectedSpecificationObject;
    sharedData.selectedCharGroup = newsharedData.selectedCharGroup;
    sharedData.update( { ...newsharedData } );
};

/**
 * Saves the selected specification on the data before navigating to the create representation panel
 * @param {Object} commandContext - context
 * @param {String} nextActiveView - Active view value,
 * @param {Object} selectedSpecification - Selected Specification,
 */
export let selectSpecificationAndNavigateToMainPanel = function( commandContext, nextActiveView, selectedSpecification ) {
    exports.switchPanelsCharManager( commandContext, nextActiveView, '', selectedSpecification );
};

/**
 * To show the Specification details on selection. BA specific changes
 * @param {Object} selectedSpecification - Selected Specification,
 */
export let showSpecificationDetailsOnSelection = function(  selectedSpecification ) {
    return selectedSpecification;
};


/**
 * To clear the filter box of panel
 * LCS-752836 - Regression: Issues related to Filter for Groups and Characteristics in 'Add Inspection Definition' panel
 */
export let clearFilterBox = function(  filterBox ) {
    if( filterBox ) {
        filterBox.dbValue = '';
    }
};

export let createInputForQualityActionInInspDefFunction = function( commandContext ) {
    commandContext.type = 'Control Plan';
    if( commandContext.vmo.modelType.typeHierarchyArray.indexOf( 'Qc0MasterCharSpec' ) > -1 ) {
        commandContext.subType = 'Reaction Plan';
    }else  if( commandContext.vmo.modelType.typeHierarchyArray.indexOf( 'Aqc0CharElementRevision' ) > -1 ) {
        commandContext.subType = 'Containment Action';
    }
    commandContext.relationType =  'Qc0HasActions';
    commandContext.primaryObj =  {
        type: commandContext.vmo.type,
        uid: commandContext.vmo.uid
    };
    return commandContext;
};

/**
 * Gets the Visual Characteristics image resolution limits.
 * @returns {Object} limits - Image resolution limits.
 */
export let getVisCharImageResolutionLimits = function( ) {
    // Take default image resolution limits.
    var limits = {};
    limits.maxSize = Number.MAX_VALUE;
    limits.minWidth = Number.MIN_VALUE;
    limits.minHeight = Number.MIN_VALUE;
    limits.maxWidth = Number.MAX_VALUE;
    limits.maxHeight = Number.MAX_VALUE;

    // Take image resolution limits specified in preference.
    let ctx = appCtxService.getCtx();
    var resolutionLimits = ctx.preferences.AQC_VIS_CHAR_IMAGE_CRITERIA;
    resolutionLimits.forEach( function( limit ) {
        var resLimit = limit.split( ':' );
        if( resLimit.length === 3 ) {
            var resParamType = resLimit[0];
            var widthLimit = parseInt( resLimit[1] );
            var heightLimit = parseInt( resLimit[2] );
            if( resParamType.toLowerCase() === 'min_res' ) {
                limits.minHeight = heightLimit;
                limits.minWidth = widthLimit;
            } else if( resParamType.toLowerCase() === 'max_res' ) {
                limits.maxHeight = heightLimit;
                limits.maxWidth = widthLimit;
            }
        } else if( resLimit.length === 2 ) {
            var sizeParamType = resLimit[0];
            var maxSize = parseFloat( resLimit[1] );
            if( sizeParamType.toLowerCase() === 'max_size' ) {
                limits.maxSize = maxSize;
            }
        }
    } );

    // Return resolution limit.
    return limits;
};

/**
 * Do image file resoluiton validation and show error message if resolution in invalid.
 * @param {Object} file - Image file.
 * @param {Object} resolutionLimits - Image file resolution limits.*
 * @returns {Object} validResolution - Flag which indicate the whether image resolution is valid or not.
 */
export let isVisCharImageResolutionValid = async function(  file, resolutionLimits ) {
    // Initially set valid validation flag as false i.e. image file has wrong resolution.
    var validResolution = false;

    // Do validation of image file resoluiton and show error message if resolution in invalid.
    await new Promise( ( resolve ) => {
        var img = new Image();
        img.onload = function() {
            // Do image resolution validation.
            var size  = file.size / 1024;
            var width  = img.naturalWidth;
            var height = img.naturalHeight;

            var localTextBundle = localeService.getLoadedText( 'qualitycharacteristicsmanagerMessages' );
            if( size <= resolutionLimits.maxSize &&
                width >= resolutionLimits.minWidth &&
                height >= resolutionLimits.minHeight &&
                width <= resolutionLimits.maxWidth &&
                height <= resolutionLimits.maxHeight ) {
                validResolution = true;
            } else {
                let maxImageSize = resolutionLimits.maxSize.toString();
                let minResolution = resolutionLimits.minWidth.toString().concat( ' x ', resolutionLimits.minHeight.toString() );
                let maxResolution = resolutionLimits.maxWidth.toString().concat( ' x ', resolutionLimits.maxHeight.toString() );
                let errorMessage = localTextBundle.Aqc0InvalidImageResolution;
                errorMessage = errorMessage.replace( '{0}', maxImageSize );
                errorMessage = errorMessage.replace( '{1}', minResolution );
                errorMessage = errorMessage.replace( '{2}', maxResolution );
                messagingSvc.showError( errorMessage );
            }
            resolve( validResolution );
        };

        // Read the image file data.
        var reader = new FileReader();
        reader.onload = function( event ) {
            img.src = event.target.result;
        };
        reader.readAsDataURL( file );
    } );

    // Return the flag which indicate the whether image resolution is valid or not.
    return validResolution;
};

/**
 * Validate the resolution of image specified in given view model data.
 * @param {Object} data - view model data.
 * @returns {Object} data - updated view model data.
 */
export let validateImageResolution = function(  data ) {
    // Initially set resolution valid flag as false i.e. image file has wrong resolution.
    data.validFileResolution = false;

    // Do validation only if image is selected.
    var fileExt = data.eventData.fileExt ? data.eventData.fileExt : '';
    if ( fileExt.toLowerCase() === 'gif' || fileExt.toLowerCase() === 'jpg' || fileExt.toLowerCase() === 'jpeg' || fileExt.toLowerCase() === 'png' ) {
        // Take expected image resolution parameters to validate image against it.
        let ctx = appCtxService.getCtx();
        if( ctx.preferences && ctx.preferences.AQC_VIS_CHAR_IMAGE_CRITERIA ) {
            // Take image resolution limits.
            var resolutionLimits = getVisCharImageResolutionLimits();

            // Take image file from data.
            var formData = data.formData;
            var file = Array.from( formData.entries() )[0][1];

            // Do image resolution validation and show error message if it is invalid.
            data.validFileResolution = isVisCharImageResolutionValid( file, resolutionLimits );
        } else {
            data.validFileResolution = true;
        }
    }

    // Return the update data.
    return data;
};

export default exports = {
    addPanelObjectCreated,
    clearFilterBox,
    executePostVersionEventActionsForSpecifications,
    getObjCreateInfoDataProcessing,
    renderEditViewForObjects,
    selectSpecificationAndNavigateToMainPanel,
    showSpecificationDetailsOnSelection,
    switchPanelsCharManager,
    createInputForQualityActionInInspDefFunction,
    validateImageResolution
};
