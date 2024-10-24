// Copyright (c) 2022 Siemens
/* global MathJax */

/**
 * Module for the Requirement Preview Page in ACE
 *
 * @module js/Arm0RequirementDocumentationACE
 */
import { getBaseUrlPath } from 'app';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import reqACEUtils from 'js/requirementsACEUtils';
import reqUtils from 'js/requirementsUtils';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import reqOLEDownloadService from 'js/Arm0RequirementOLEDownloadService';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import eventBus from 'js/eventBus';
import Arm0DocumentationUtil from 'js/Arm0DocumentationUtil';
import requirementsUtils from 'js/requirementsUtils';

var exports = {};
var revIndex = 0;
var view1uid = null;
var view2uid = null;
var _data = null;
var index = 0;
var _mapOleRMElement = {};
var PAGE_SIZE = 3;
var _refreshOnTracelinkCreationListener = null;
// This will avoid loading content/imgs
var tempDocument = document.implementation.createHTMLDocument( 'Test Doc' );

/**
 * Get Input object.
 *
 * @param {Object} ctx - ctx
 * @return {Object} object
 */
var _getInputObject = function( ctx ) {
    var selectObj = ctx.selected;
    if( ctx.splitView && ctx.splitView.mode === true && ctx.occmgmtContext && ctx.occmgmtContext2 ) {
        var uid = selectObj.uid;
        var modelObject1 = ctx.occmgmtContext.selectedModelObjects[ '0' ];
        var modelObject2 = ctx.occmgmtContext2.selectedModelObjects[ '0' ];

        if( modelObject1.uid === modelObject2.uid ) {
            selectObj = modelObject1;
        } else {
            if( view1uid && view1uid !== modelObject1.uid && view2uid && view2uid !== modelObject2.uid ) {
                revIndex = 0;
            }
            if( !view2uid && revIndex === 1 || view2uid && view2uid !== modelObject2.uid ) {
                uid = modelObject2.uid;
                view2uid = uid;
                revIndex = 0;
                selectObj = modelObject2;
            } else if( !view1uid && revIndex === 0 || view1uid && view1uid !== modelObject1.uid ) {
                uid = modelObject1.uid;
                view1uid = uid;
                revIndex = 1;
                selectObj = modelObject1;
            }
        }
    }
    return {
        uid: selectObj.uid,
        type: selectObj.type
    };
};

/**
 * Get NextOccuraceData .
 *
 * @param {Object} data - view model data
 * @param {Object} ctx - ctx
 * @param {Object} inputCtxt -
 * @returns {Array} Next child occ data
 */
var _getNextOccuranceData = function( data, ctx, inputCtxt ) {
    var nextChildOccData = {};

    data.goForward = true;
    var prodCtxt = occMgmtStateHandler.getProductContextInfo();
    if( prodCtxt ) {
        nextChildOccData = reqACEUtils.getCursorInfoForFirstFetch( prodCtxt, PAGE_SIZE, data.goForward, inputCtxt );
    }

    return nextChildOccData;
};

export let processResponse = function( response ) {
    fmsUtils.openFile( response.data.fmsTicket, response.data.fileName );
};

export let updateSOAInput = function( ctx, data ) {
    _data = data;
    var soaInput = ctx.microserviceInput.soaInput;
    soaInput.clientId = '';
    soaInput.options.push( 'MSWordExportMode' );
    soaInput.options.push( 'EditMode' );
    soaInput.options.push( 'includeComments' );
    ctx.isExportToPDFIsInProgress = true;
};

export let processResponseOfSpecNavigation = function( response ) {
    var htmlContents = response.output.htmlContents[ 0 ];
    _data.htmlContents = htmlContents;
    _data.markUpData = response.output.markUpData;
    eventBus.publish( 'Arm0ExportToRoundTripWordDocument.exportToWord' );
};

export let getMicroserviceURL = function() {
    return browserUtils.getBaseURL() + 'tc/micro/ReqExport/v1/api/export/exportDocument';
};

/**
 * Get Input data for getSpecificationSegment.
 *
 * @param {Object} data - The panel's view model object
 * @param {Object} ctx - Application context
 * @returns {Object} - Json object
 */
export let getSpecificationSegmentInput = function( data, ctx ) {
    var inputCtxt = reqACEUtils.getInputContext();
    var inputData = {
        inputCtxt: inputCtxt,
        inputObjects: [ _getInputObject( ctx ) ],
        nextOccData: _getNextOccuranceData( data, ctx, inputCtxt ),
        options: [ 'FirstLevelOnly' ]
    };
    if( ctx.xrtPageContext && ctx.xrtPageContext.secondaryXrtPageID && ctx.xrtPageContext.secondaryXrtPageID === 'tc_xrt_Overview' ) {
        inputData.options.push( 'isOverviewTabRequest' );
    }
    appCtxSvc.registerCtx( 'microserviceInput', {
        soaInput: inputData
    } );

    return inputData;
};

/**
 * set OLE object to download
 *
 * @param {Object} data - The panel's view model object
 */
export let setOLEObjectToDownload = function( data ) {
    data.oleObjsToDownload = [];

    if( data.response && data.response.modelObjects ) {
        var modelObj = reqACEUtils.getObjectOfType( data.response.modelObjects, 'ImanFile' );

        if( modelObj !== null ) {
            data.oleObjsToDownload = [ modelObj ];
        }
    }
};

/**
 * Get Requirement top Element of Panel.
 *
 * @return {Object} HTML element
 */
var _getRMElement = function() {
    var element = document.getElementsByClassName( 'aw-requirements-xrtRichText' );
    if( !element || element.length <= 0 ) {
        return null;
    }
    return element;
};

/**
 * On click on Header object click listener
 *
 * @param {Object} target - The target element
 */
var onClickOnHeader = function( target ) {
    var idAceElement = target.parentElement.getAttribute( 'id' );
    if( idAceElement ) {
        var eventData = {
            objectsToSelect: [ { uid: idAceElement } ]
        };
        eventBus.publish( 'aceElementsSelectionUpdatedEvent', eventData );
    }
};

/**
 * Add chevron element in the given requirement element
 *
 * @param {String} rmElement - html element
 */
var _addChevronToHeader = function( rmElement ) {
    var chevronElement = document.createElement( 'div' );
    chevronElement.classList.add( 'aw-layout-panelSectionTitleChevron' );
    chevronElement.innerHTML = reqACEUtils.getChevronIcon();
    chevronElement.addEventListener( 'click', function( event ) {
        reqACEUtils.collapseRequirement( rmElement );
        eventBus.publish( 'requirement.resizeView' );
        event.stopPropagation();
    }, rmElement );
    var rmHeaders = rmElement.getElementsByClassName( 'aw-requirement-header' );
    rmHeaders[ 0 ].insertBefore( chevronElement, rmHeaders[ 0 ].children[ 0 ] );
    // Check if requirement is already collapsed
    reqACEUtils.checkCollapsedState( rmElement );
};

/**
 * OLE object click listener
 *
 * @param {Event} event The event
 */
var onClickOnOLEObject = function( event ) {
    var target = event.currentTarget;
    if( target && target.hasAttribute( 'oleid' ) ) {
        reqOLEDownloadService.handleOLEClick( target, _data );
    }
};

/**
 * Add click event on OLE Objects.
 *
 * @param {Object} innerHtml html content element
 */
var _addEvents = function( innerHtml ) {
    var rmElements = innerHtml.getElementsByClassName( 'requirement' );

    for( var index = 0; index < rmElements.length; index++ ) {
        var rmElement = rmElements[ index ];
        var idAceElement = rmElement.getAttribute( 'id' );

        // Add click event on Requirement Title Header
        var rmHeaders = rmElement.getElementsByClassName( 'aw-requirement-header' );
        for( var i = 0; i < rmHeaders.length; i++ ) {
            var rmHeader = rmHeaders[ i ];

            rmHeader.classList.add( 'aw-widgets-cellListItem' );
            // Add click event on header for cross-probing.
            rmHeader.addEventListener( 'click', function( event ) {
                var target = event.currentTarget;
                onClickOnHeader( target );
            } );
        }
        // Add element to collapse
        _addChevronToHeader( rmElement );

        // Add click event on OLE objects
        var imgs = rmElement.getElementsByTagName( 'img' );
        for( var ii = 0; ii < imgs.length; ii++ ) {
            var oleElement = imgs[ ii ];
            var idOleElement = oleElement.getAttribute( 'oleid' );

            if( idOleElement ) {
                _mapOleRMElement[ idOleElement ] = idAceElement;
                oleElement.addEventListener( 'click', onClickOnOLEObject );
            }
        }
    }
};

/**
 * Remove non requirement objects
 *
 * @param {Object} modelObjects -  model objects
 * @return {Object} model objects
 */
var _removeNonRequirementObjects = function( modelObjects ) {
    var objects = modelObjects;
    var arr = [];
    for( var key in modelObjects ) {
        var object = objects[ key ];
        var modelObj = cdm.getObject( object.uid );
        var typeHierarchy = modelObj.modelType.typeHierarchyArray;
        if( typeHierarchy.indexOf( 'RequirementSpec Revision' ) > -1 ) {
            arr.push( object );
        }
    }
    return arr;
};

/**
 * get Revision Object.
 *
 * @param {Object} uid - uid of awb0Element or revision object
 * @return {Object} Revision Object
 */
var _getRevObject = function( uid ) {
    var revObject = cdm.getObject( uid );
    if( revObject && revObject.props && revObject.props.awb0UnderlyingObject ) {
        return cdm.getObject( revObject.props.awb0UnderlyingObject.dbValues[ 0 ] );
    }
    return revObject;
};

/**
 * Set viewer content
 *
 * @param {Object} data - The panel's view model object
 * @param {String} htmlContent - html Content
 *
 */
var _setViewerContent = function( data, htmlContent, ctx ) {
    var requirementElement = _getRMElement();

    var elementChild = tempDocument.createElement( 'div' );

    elementChild.className += ' aw-richtexteditor-documentPaper aw-richtexteditor-document aw-richtexteditor-documentPanel';

    elementChild.innerHTML = htmlContent;

    requirementsUtils.prepareAndUpdateListStyleType( elementChild );

    reqACEUtils.updateMarkers( elementChild, data, undefined, true );

    reqUtils.insertTypeIconToOleObjects( elementChild );

    _addEvents( elementChild );

    if( requirementElement && requirementElement.length && requirementElement.length === 1 ) {
        index = 0;
    }

    if( requirementElement && requirementElement.length && requirementElement.length > 1 && ctx.splitView && ctx.splitView.mode === true && ctx.occmgmtContext && ctx.occmgmtContext2 && ctx
        .occmgmtContext.selectedModelObjects[ '0' ].uid !== ctx.occmgmtContext2.selectedModelObjects[ '0' ].uid ) {
        var revObject1 = _getRevObject( ctx.occmgmtContext.selectedModelObjects[ '0' ].uid );
        var revObject2 = _getRevObject( ctx.occmgmtContext2.selectedModelObjects[ '0' ].uid );

        var modelObjects = _removeNonRequirementObjects( data.content.ServiceData.modelObjects );
        if( modelObjects && modelObjects[ 0 ].uid === revObject2.uid ) {
            index = 1;
        } else if( modelObjects && modelObjects[ 0 ].uid === revObject1.uid ) {
            index = 0;
        }
    }

    if( requirementElement ) {
        requirementElement[ index ].innerHTML = ''; // Clear childs so that it will clear earlier data
        requirementElement[ index ].appendChild( elementChild );
    }
};

/**
 * Register an event to refresh documentation tab on tracelink creation
 */
var _registerEventToRefreshDocTabOnTracelinkCreation = function() {
    // Listen for when tracelink created and documentation tab needs refresh
    if( !_refreshOnTracelinkCreationListener ) {
        _refreshOnTracelinkCreationListener = eventBus.subscribe( 'requirementDocumentation.updateDocumentationTabPostCTL', function( eventData ) {
            exports.updateDocumentationTabPostCTL( eventData.startItems, eventData.endItems );
        }, 'Arm0RequirementDocumentationACE' );
    }
};

/**
 * Initialize HTML content
 *
 * @param {Object} data - The panel's view model object
 */
export let initContent = function( data, ctx ) {
    if( data.content ) {
        _data = data;
        var htmlContent = data.content.htmlContents[ 0 ];
        htmlContent = reqUtils.correctAnchorTags( htmlContent );

        _setViewerContent( data, htmlContent, ctx );

        _registerEventToRefreshDocTabOnTracelinkCreation();

        if( ctx.splitView && ctx.splitView.mode === true && ctx.occmgmtContext.currentState.uid === ctx.occmgmtContext2.currentState.uid ) {
            if( index === 0 ) {
                index = 1;
            } else if( index === 1 ) {
                index = 0;
            }
        }

        // Attach and listen click event on viewer container
        var requirementElement = _getRMElement();
        if( requirementElement ) {
            Arm0DocumentationUtil.attachClickEventOnViewer( requirementElement[ index ] );

            // Render Equation in React DOM
            reqUtils.loadEquationAsReactComponents( requirementElement[ index ] );
        }
    }
};

/**
 * UnRegister the events on page content unloading
 *
 */
export let pageContentUnloaded = function() {
    if( _refreshOnTracelinkCreationListener ) {
        eventBus.unsubscribe( _refreshOnTracelinkCreationListener );
        _refreshOnTracelinkCreationListener = null;
    }
};

/**
 * This method is use to iterate the specSegmentArray and return true if any updated object present in the
 * available spec content.
 *
 * @param {Object} data - panels view model data
 * @param {Array} updatedObjectIds - uids of the updated objects
 * @return {Boolean} true, if updated object present on documentation tab
 */
var _isObjectPresentInContentData = function( data, updatedObjectIds ) {
    if( data.content && data.content.specContents && data.content.specContents.length > 0 ) {
        var specContentData = data.content.specContents;
        for( var index = 0; index < specContentData.length; index++ ) {
            var specSegmentContent = specContentData[ index ];
            var occurrenceUid = specSegmentContent.occurrence.uid;
            var revisionUid = specSegmentContent.specElemRevision.uid;
            if( updatedObjectIds.indexOf( occurrenceUid ) >= 0 || updatedObjectIds.indexOf( revisionUid ) >= 0 ) {
                return true;
            }
        }
    }
    return false;
};

/**
 * Update documentation tab on tracelink creation if tracelinked ojects present on the documentation tab
 *
 * @param {Array} startItems - Array of modified objects from start bucket
 * @param {Array} endItems - Array of modified objects from end bucket
 */
export let updateDocumentationTabPostCTL = function( startItems, endItems ) {
    var updatedObjects = [];
    var i;
    for( i = 0; i < startItems.length; i++ ) {
        updatedObjects.push( startItems[ i ].uid );
    }
    for( i = 0; i < endItems.length; i++ ) {
        updatedObjects.push( endItems[ i ].uid );
    }

    if( _isObjectPresentInContentData( _data, updatedObjects ) ) {
        // Refresh
        eventBus.publish( 'requirementDocumentation.refreshDocumentationTab' );
    }
};

/**
 * Update documentation tab on tracelink deletion if tracelinked ojects present on the documentation tab
 */
export let deleteTracelinkFromTooltipInAceOverview = function( data ) {
    // Refresh
    eventBus.publish( 'requirementDocumentation.refreshDocumentationTab' );
};

/**
 * Update marker on model object update
 *
 * @param {Array} modifiedObjects - Array of modified objects
 */
export let refreshMarkersOnObjectModified = function( modifiedObjects ) {
    if( _data ) {
        var requirementElementsToBeUpdated = reqACEUtils.getRequirementDivElementsFromUids( modifiedObjects, false, null );
        if( requirementElementsToBeUpdated.length > 0 ) {
            for( var i = 0; i < requirementElementsToBeUpdated.length; i++ ) {
                var reqElement = requirementElementsToBeUpdated[ i ];
                reqACEUtils.updateTracelinkMarker( _data, reqElement );
            }
        }
    }
};
export let getWaterMarkInformation = function( data ) {
    if( data.ckEditorInstance !== undefined ) {
        return {
            waterMarkXMLText: data.ckEditorInstance.getData(),
            layout: data.layout.dbValue
        };
    }
    return {
        waterMarkXMLText: '',
        layout: ''
    };
};
export default exports = {
    processResponse,
    updateSOAInput,
    processResponseOfSpecNavigation,
    getMicroserviceURL,
    getSpecificationSegmentInput,
    setOLEObjectToDownload,
    initContent,
    pageContentUnloaded,
    updateDocumentationTabPostCTL,
    refreshMarkersOnObjectModified,
    deleteTracelinkFromTooltipInAceOverview,
    getWaterMarkInformation
};
