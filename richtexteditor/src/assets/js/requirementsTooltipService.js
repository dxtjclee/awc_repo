// Copyright (c) 2021 Siemens

/**
 * @module js/requirementsTooltipService
 */
import cdm from 'soa/kernel/clientDataModel';
import iconService from 'js/iconService';
import soaService from 'soa/kernel/soaService';
import tcVmoService from 'js/tcViewModelObjectService';
import $ from 'jquery';
import browserUtils from 'js/browserUtils';
import eventBus from 'js/eventBus';
import dmService from 'soa/dataManagementService';
import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import reqACEUtils from 'js/requirementsACEUtils';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import soaSvc from 'soa/kernel/soaService';

var _soaSvc = null;

var _cmm = null;

var _tracelinkedItems = null;
var _showMoreTracelinkOption = null;
var _selectedTooltipObject = null;
var _selectedTracelinkedObject = null;
var _selectedSpecContentInfo = null;
var _specContentData = null;
var PAGE_SIZE = 3;
var exports = {};


/**
 * Set tracelink tooltip data.
 *
 * @param {Object} data - view model object data
 * @param {String} selectedOccurrence - uid of selected occurrance
 */
export let setTooltipContentData = function( data, selectedOccurrence ) {
    var popupheight = null;
    _tracelinkedItems = null;
    _selectedTooltipObject = selectedOccurrence;
    var isBasedOn = selectedOccurrence.isBasedon;
    var masterReqName = selectedOccurrence.masterReqName;
    var masterReqUid = selectedOccurrence.masterReqUid;
    var isderived = selectedOccurrence.isderived;
    var basedOnMasterReqName = selectedOccurrence.basedOnMasterReqName;
    var basedonmasterreqid = selectedOccurrence.basedonmasterreqid;
    var tlCount = parseInt( selectedOccurrence.tlCount );

    // Get SpecContent data from all pages
    _specContentData = [];
    if ( data.content.specContents ) {
        _specContentData = data.content.specContents;
    }

    if ( _specContentData.length > 0 && selectedOccurrence ) {
        var tracelinkInfo;

        // Get specContent for selected element
        for ( var i = 0; i < _specContentData.length; i++ ) {
            var specContent = _specContentData[i];
            if ( specContent && specContent.occurrence && specContent.occurrence.uid === selectedOccurrence.uid ) {
                _selectedSpecContentInfo = specContent;
                tracelinkInfo = specContent.tracelinkInfo;
                break;
            }
        }

        // Create tracelink popup info
        var tracelinkedItems = [];
        var reuseRelations = 0;

        if ( tracelinkInfo && tracelinkInfo.definingLinksInfo && tracelinkInfo.complyingLinksInfo &&
            tracelinkInfo.numOfLinks === tlCount
        ) {
            popupheight = istoolTipArrow( tracelinkInfo, tracelinkedItems, reuseRelations, isBasedOn, isderived, masterReqName, masterReqUid, basedOnMasterReqName, basedonmasterreqid, data );
            data.content.specContents = _specContentData;
        }
        //soa call to get the latest specdata
        else {
            var promise = getTooltip( data );
            promise.then( function( response ) {
                if ( response.output.specContents ) {
                    _specContentData = response.output.specContents;
                }
                for ( var i = 0; i < _specContentData.length; i++ ) {
                    var specContent = _specContentData[i];
                    if ( specContent && specContent.occurrence && specContent.occurrence.uid === selectedOccurrence.uid ) {
                        _selectedSpecContentInfo = specContent;
                        tracelinkInfo = specContent.tracelinkInfo;
                        break;
                    }
                }
                popupheight = istoolTipArrow( tracelinkInfo, tracelinkedItems, reuseRelations, isBasedOn, isderived, masterReqName, masterReqUid, basedOnMasterReqName, basedonmasterreqid, data );
                data.content.specContents = _specContentData;
                data.popupheight = popupheight;
            } );
        }
    }
};
function getTooltip( data ) {
    var inputCtxt = reqACEUtils.getInputContext();
    var inputObjects = [];
    inputObjects.push( { uid: data.content.specContents[0].occurrence.uid } );
    let soaInput = {
        inputData: {
            inputCtxt: inputCtxt,
            inputObjects: inputObjects,
            nextOccData: _getNextOccuranceData( data, inputCtxt ),
            options: [ 'FirstLevelOnly', 'EditMode' ]
        }
    };

    return soaSvc.postUnchecked( 'Internal-AwReqMgmtSe-2019-06-SpecNavigation', 'getSpecificationSegment',
        soaInput );
}

function istoolTipArrow( tracelinkInfo, tracelinkedItems, reuseRelations, isBasedOn, isderived, masterReqName, masterReqUid, basedOnMasterReqName, basedonmasterreqid, data ) {
    var popupheight;

    // Defining Links
    for ( var i = 0; i < tracelinkInfo.definingLinksInfo.length && tracelinkedItems.length < 5; i++ ) {
        var definingLinkInfo = tracelinkInfo.definingLinksInfo[i];
        var definingLinkIcon = 'cmdShowIncomingRelations';
        var itemP = _getTracelinkedItem( definingLinkInfo, definingLinkIcon, data );
        itemP.relations = 'Primary';
        //_setSuspectTasksToTracelinkedItem( itemP );
        tracelinkedItems.push( itemP );
    }

    // Complying Links
    for ( var i = 0; i < tracelinkInfo.complyingLinksInfo.length && tracelinkedItems.length < 5; i++ ) {
        var complyingLinkInfo = tracelinkInfo.complyingLinksInfo[i];
        var complyingLinkIcon = 'cmdShowOutgoingRelations';
        var itemS = _getTracelinkedItem( complyingLinkInfo, complyingLinkIcon, data );
        itemS.relations = 'Secondary';
        //_setSuspectTasksToTracelinkedItem( itemS );
        tracelinkedItems.push( itemS );
    }


    // add suspect flag on tracelinked objects
    if ( tracelinkedItems.length > 0 ) {
        _setSuspectTasksToTracelinkedItem( tracelinkedItems );
    }

    if ( isBasedOn ) {
        var itemB = _getBasedOnLinks( basedOnMasterReqName, basedonmasterreqid, data );
        tracelinkedItems.push( itemB );
        reuseRelations += 1;
    }

    if ( isderived ) {
        var itemD = _getDerivedFromLinks( masterReqName, masterReqUid, data );
        tracelinkedItems.push( itemD );
        reuseRelations += 1;
    }

    if ( tracelinkedItems.length > 0 ) {
        _tracelinkedItems = tracelinkedItems;

        // Calculate popup panel height
        popupheight = 41 * tracelinkedItems.length + 32; // height of each item - 41; margin for list - 32
        // Increase height to show 'more' option
        popupheight += 45;
        _showMoreTracelinkOption = true;
    }

    data.popupheight = popupheight;
    return {
        popupheight: popupheight
    };
}


var _getNextOccuranceData = function( data, ctx, inputCtxt ) {
    var nextChildOccData = {};

    data.goForward = true;
    var prodCtxt = occMgmtStateHandler.getProductContextInfo();
    if ( prodCtxt ) {
        nextChildOccData = reqACEUtils.getCursorInfoForFirstFetch( prodCtxt, PAGE_SIZE, data.goForward, inputCtxt );
    }

    return nextChildOccData;
};

/**
 * Attach isSuspect flag to given list of objects based on awb0IsSuspect prop
 *
 * @param {Array} objects - array of object
 */
var _setSuspectTasksToTracelinkedItem = function( objects ) {
    var objectsToFindProperty = [];
    var objectUidsToFindProperty = [];
    var propName = 'fnd0MyWorkflowTasks';

    // If fnd0MyWorkflowTasks is already loaded
    _.forEach( objects, function( object ) {
        var uid = object.id;
        var modelObject = cdm.getObject( uid );
        if( modelObject && modelObject.props && modelObject.props.hasOwnProperty( propName ) ) {
            object.suspectReviewTaskList = _getSuspectReviewTasks( modelObject.props[ propName ] );
        } else {
            objectsToFindProperty.push( object );
            objectUidsToFindProperty.push( uid );
        }
    } );

    // Load fnd0MyWorkflowTasks property if not loaded already
    if( objectUidsToFindProperty.length > 0 ) {
        var propPromise = dmService.getProperties( objectUidsToFindProperty, [ propName ] );
        propPromise.then( function( response ) {
            if( response && response.modelObjects ) {
                // true means that group has system administration privilege, and so all the members
                // of this group also have system administration privilege.
                _.forEach( objectsToFindProperty, function( object ) {
                    object.suspectReviewTaskList = _getSuspectReviewTasks( response.modelObjects[ object.id ].props[ propName ] );
                } );
            }
        }, objectsToFindProperty );
    }
};

/**
 * Get the suspect review task uids from given list of all task uids
 *
 * @param {Object} prop - object property object
 * @returns {Array} - array of uids
 */
var _getSuspectReviewTasks = function( prop ) {
    var suspectTasks = [];
    for( var index = 0; index < prop.uiValues.length; index++ ) {
        var uiValue = prop.uiValues[ index ];
        if( uiValue === 'Review Suspect' ) { // 'Review Suspect' - name of suspect task, added in workflow template
            suspectTasks.push( prop.dbValues[ index ] );
        }
    }
    return suspectTasks;
};

/**
 * Create and return the tracelinked item from info
 *
 * @param {Object} linkInfo
 * @param {String} linkIcon
 */
var _getTracelinkedItem = function( linkInfo, linkIcon, data ) {
    var uid = linkInfo.obj.uid;
    var type = linkInfo.obj.type;
    var sourceObj = cdm.getObject( uid );
    if ( sourceObj.props.items_tag ) {
        var name = sourceObj.props.items_tag.uiValues[0] ? sourceObj.props.items_tag.uiValues[0] : linkInfo.name;
    } else {
        var name = linkInfo.name;
    }
    return {
        displayName: name,
        objectId: linkInfo.id,
        iconURL: _getTypeIconURL( type, linkInfo.typeHierarchy ),
        tracelinkIcon: linkIcon,
        isSuspectIcon: 'cmdReviewSuspect',
        openTracelinkedObjectIcon: 'cmdOpen',
        openTracelinkedObjectTitle: data && data.i18n && data.i18n.openRequirementsTitle ? data.i18n.openRequirementsTitle : '',
        removeTracelinkedObjectIcon: 'cmdDelete',
        removeTracelinkedObjectTitle: data && data.i18n && data.i18n.delete ? data.i18n.delete : '',
        reviewSuspectTitle: data && data.i18n && data.i18n.reviewSuspectTitle ? data.i18n.reviewSuspectTitle : '',
        id: uid,
        isTracelinkedItem: true
    };
};

var _getBasedOnLinks = function( masterReqName, basedonmasterreqid, data ) {
    var sourceObj = cdm.getObject( _selectedTooltipObject.uid );

    return {
        displayName: masterReqName,
        id: basedonmasterreqid,
        iconURL: iconService.getTypeIconURL( sourceObj.type ),
        openbasedOnMasterReqIcon: 'cmdOpen',
        tracelinkIcon: 'indicatorBasedOn',
        openbasedOnMasterReqTitle: data && data.i18n && data.i18n.openMasterReqTitle ? data.i18n.openMasterReqTitle : '',
        isBasedOn: true

    };
};
var _getDerivedFromLinks = function( masterReqName, masterReqUid, data ) {
    var sourceObj = cdm.getObject( _selectedTooltipObject.uid );

    return {
        displayName: masterReqName,
        id: masterReqUid,
        iconURL: iconService.getTypeIconURL( sourceObj.type ),
        openMasterReqIcon: 'cmdOpen',
        tracelinkIcon: 'indicatorDerived',
        openMasterReqTitle: data && data.i18n && data.i18n.openMasterReqTitle ? data.i18n.openMasterReqTitle : '',
        isBasedOn: true
    };
};

/**
 * Return tracelink tooltip content data
 *
 * @param {Object} tooltip content data
 * @param {Object} context object
 */
export let getTooltipContentData = function() {
    var sourceObj = cdm.getObject( _selectedTooltipObject.uid );
    if( !sourceObj ) {
        sourceObj = _selectedTooltipObject;
    }
    appCtxService.updateCtx( 'Arm0TraceLinkTooltipBalloonPopupVisible', true );

    return {
        showMoreTracelinkOption : _showMoreTracelinkOption,
        selectedTooltipObject : sourceObj,
        tracelinkedItems : _tracelinkedItems
    };
};

/**
 * Opens tracelink panel
 *
 * @param {Object} data content data
 */
export let moreTracelinkClicked = function( object ) {
    appCtxService.registerCtx( 'ExistingTraceLinkPopupSelectedObjUid', object );
    eventBus.publish( 'Arm0ExistingTraceLinkTree.activateExistingTraceLinkPanel' );
};

/*
 * Return the type icon url for given type
 *
 * @param {String} typeName - type name
 * @param {String} typeHierarchy - type Hierarchy separated by comma
 */
var _getTypeIconURL = function( typeName, typeHierarchy ) {
    var typeIconString = iconService.getTypeIconURL( typeName );

    if( !typeIconString && typeHierarchy ) {
        var typeHierarchyArray = typeHierarchy.split( ',' );
        for( var ii = 0; ii < typeHierarchyArray.length && !typeIconString; ii++ ) {
            typeIconString = iconService.getTypeIconURL( typeHierarchyArray[ ii ] );
        }
    }

    if( !typeIconString ) {
        typeIconString = iconService.getTypeIconURL( 'MissingImage' );
    }

    return browserUtils.getBaseURL() + typeIconString;
};

/**


 * Close instance of aw-balloon-popup created to show tracelink information and executes the desired hide/show
 * action.
 *
 * @param {Object} ctx
 * @param {boolean} noHoverCheck
 */
export let closeExistingTracelinkTooltip = function( ctx, noHoverCheck ) {
    if( ctx.Arm0TraceLinkTooltipBalloonPopupVisible && ctx.Arm0TraceLinkTooltipBalloonPopupVisible === true ) {
        var panelId = 'Arm0TraceLinkTooltipBalloonPopup';
        var awTracelinkBalloonPopup = $( 'body' ).find( 'aw-balloon-popup-panel#' + panelId );
        if( awTracelinkBalloonPopup && awTracelinkBalloonPopup.length > 0 ) {
            if( $( '#' + panelId + ':hover' ).length > 0 && !noHoverCheck ) {
                return;
            }
            // FIXME, ngModule no longer defined, needs to be updated
            // var popupElemScope = ngModule.element( awTracelinkBalloonPopup ).scope();

            var eventData = {
                popupId: awTracelinkBalloonPopup[ 0 ].id
            };
            eventBus.publish( 'balloonPopup.Close', eventData );
            awTracelinkBalloonPopup.detach();
        }
        appCtxService.updateCtx( 'Arm0TraceLinkTooltipBalloonPopupVisible', false );
    }
};

/**
 * populate cut relation input data
 *
 * @return {input} input data of cut relation
 */
export let getCutTracelinkInput = function( sourceObject ) {
    _selectedTracelinkedObject = sourceObject;
    var propNames = [ 'object_string' ];
    var modelObjectsList = [ cdm.getObject( _selectedTracelinkedObject.id ) ];

    tcVmoService.getViewModelProperties( modelObjectsList, propNames ).then( function() {} );

    var uidProxyTracelink = _selectedTracelinkedObject.objectId;
    var elementsToRemove = {};
    if( uidProxyTracelink ) {
        elementsToRemove = [ {

            uid: uidProxyTracelink
        } ];
    }
    return elementsToRemove;
};

/**
 * Return the selected tracelinked objects
 *
 * @return {Array} Array of model objects
 */
export let getTracelinkedObjects = function() {
    var modelObjects = [];
    modelObjects.push( { uid: _selectedTracelinkedObject.id, type: '' } );
    modelObjects.push( { uid: _selectedTooltipObject.uid, type: '' } );
    modelObjects.push( { uid: _selectedTooltipObject.objectId, type: '' } );

    return modelObjects;
};

/**
 * @return {Object} the selected tracelinked object in the tooltip
 */
export let getSelectedTracelinkedObject = function() {
    var sourceObj = cdm.getObject( _selectedTracelinkedObject.id );
    if( sourceObj && sourceObj.props && sourceObj.props.object_string ) {
        return sourceObj;
    }

    if( !sourceObj || !sourceObj.uid ) {
        sourceObj = { uid: _selectedTracelinkedObject.id };
    }
    if( !sourceObj.props ) {
        sourceObj.props = {};
    }
    if( !sourceObj.props.object_string ) {
        // If properties not loaded, create the object_string property to display on the notification message.
        sourceObj.props.object_string = {
            uiValues: [ _selectedTracelinkedObject.displayName ]
        };
    }
    return sourceObj;
};

/**
 * @return {Object} the requirement object on which hovered to see the tooltip
 */
export let getSelectedTooltipObject = function() {
    return cdm.getObject( _selectedTooltipObject.uid );
};

/**
 * Delete tracelinked object from the tooltip data.
 */
export let deleteTracelinkFromTooltip = function() {
    var objects = exports.getTracelinkedObjects();
    var sourceObj = cdm.getObject( _selectedTooltipObject.uid );
    var sourceObjRev = cdm.getObject( sourceObj.props.awb0UnderlyingObject.dbValues[ 0 ] );
    if( sourceObjRev ) {
        objects.push( sourceObjRev );
    }

    var destObjuid = '';

    var tracelinkInfoOfSelectedTracelinkedObject;
    // Get specContent for selected element
    for( var i = 0; i < _specContentData.length; i++ ) {
        var specContent = _specContentData[ i ];
        var sourceRev = _getRevisionObject( specContent.occurrence.uid );
        if( sourceRev && sourceRev.uid === _selectedTracelinkedObject.id ) {
            tracelinkInfoOfSelectedTracelinkedObject = specContent.tracelinkInfo;
            destObjuid = specContent.occurrence.uid;
            break;
        }
    }
    var destObj = cdm.getObject( destObjuid );
    if( destObj ) {
        objects.push( destObj );
    }
    soaService.postUnchecked( 'Core-2007-01-DataManagement', 'refreshObjects', {
        objects: objects
    } ).then( function( response ) {
        var modelObjects = exports.getTracelinkedObjects();
        eventBus.publish( 'cdm.relatedModified', {
            relatedModified: modelObjects
        } );
        var tracelinkInfo = _selectedSpecContentInfo.tracelinkInfo;
        _deleteObjectFromTracelinkInfo( tracelinkInfo, _selectedTracelinkedObject.id, _selectedTracelinkedObject.objectId );
        var selectedTooltipObjectRev = _getRevisionObject( _selectedTooltipObject.uid );
        if( selectedTooltipObjectRev && selectedTooltipObjectRev.uid ) {
            _deleteObjectFromTracelinkInfo( tracelinkInfoOfSelectedTracelinkedObject, selectedTooltipObjectRev.uid, _selectedTracelinkedObject.objectId );
        }
        var modifiedObjects = exports.getTracelinkedObjects();
        var eventData = {};
        eventData.modifiedObjects = modifiedObjects;
        eventBus.publish( 'requirementDocumentation.refreshTracelinkMarkers', eventData );
    } );
};

/**
 * get Revision Object.
 *
 * @param {Object} obj - Awb0Element or revision object
 * @return {Object} Revision Object
 */
var _getRevisionObject = function( uid ) {
    var sourceOcc = cdm.getObject( uid );
    if( sourceOcc && sourceOcc.props && sourceOcc.props.awb0UnderlyingObject ) {
        return cdm.getObject( sourceOcc.props.awb0UnderlyingObject.dbValues[ 0 ] );
    }
    return sourceOcc;
};

/**
 * Remove deleted tracelinks from the tracelink info
 *
 * @param {String} typeName - type name
 * @param {String} typeHierarchy - type Hierarchy separated by comma
 */
var _deleteObjectFromTracelinkInfo = function( tracelinkInfo, uidToDelete, deletedTLid ) {
    if( tracelinkInfo ) {
        // Defining Links
        for( var i = tracelinkInfo.definingLinksInfo.length - 1; i >= 0; i-- ) {
            var definingLinkInfo = tracelinkInfo.definingLinksInfo[ i ];
            if( definingLinkInfo.obj.uid === uidToDelete && definingLinkInfo.id === deletedTLid ) {
                tracelinkInfo.definingLinksInfo.splice( i, 1 );
                tracelinkInfo.numOfLinks -= 1;
            }
        }

        // Complying Links
        for( var i = tracelinkInfo.complyingLinksInfo.length - 1; i >= 0; i-- ) {
            var complyingLinkInfo = tracelinkInfo.complyingLinksInfo[ i ];
            if( complyingLinkInfo.obj.uid === uidToDelete && complyingLinkInfo.id === deletedTLid ) {
                tracelinkInfo.complyingLinksInfo.splice( i, 1 );
                tracelinkInfo.numOfLinks -= 1;
            }
        }
    }
};


export default exports = {
    setTooltipContentData,
    getTooltipContentData,
    closeExistingTracelinkTooltip,
    getCutTracelinkInput,
    getTracelinkedObjects,
    getSelectedTracelinkedObject,
    getSelectedTooltipObject,
    deleteTracelinkFromTooltip,
    moreTracelinkClicked
};
