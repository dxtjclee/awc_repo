/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 * @module js/requirementsACEUtils
 */
import { getBaseUrlPath } from 'app';
import dateTimeSrv from 'js/dateTimeService';
import cdm from 'soa/kernel/clientDataModel';
import iconService from 'js/iconService';
import awIconService from 'js/awIconService';
import commandsMapService from 'js/commandsMapService';
import cmm from 'soa/kernel/clientMetaModel';
import appCtxService from 'js/appCtxService';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import browserUtils from 'js/browserUtils';
import fmsUtils from 'js/fmsUtils';
import reqUtils from 'js/requirementsUtils';
import AwPromiseService from 'js/awPromiseService';
import ckeditorOperations from 'js/ckeditorOperations';
import arm0ShowActionPanel from 'js/Arm0ShowActionsPanelView';
import rmCkeditorService from 'js/Arm0CkeditorService';
import sanitizer from 'js/sanitizer';
import { svgString as MiscCollapse } from 'image/miscCollapse16.svg';
import { svgString as MiscExpand } from 'image/miscExpand16.svg';
import { svgString as indicatorTraceLink } from 'image/indicatorTraceLink16.svg';
import { svgString as cmdCreateTraceLink } from 'image/cmdCreateTraceLink24.svg';


var exports = {};

var CKE_IMG_REFNAME_PREFIX = 'tccke_ref_';

var PAGE_SIZE = 3;

/**
 * Style attribute to show background color as gray and pointer cursor
 */
var STYLES_FOR_READ_ONLY_REQ = 'background-color:#f0f0f0;';

/**
 * The outline is shown in chrome for the divs which have contenteditable=true attribute. So adding this Style
 * attribute to avoid outline.
 */
var STYLES_TO_AVOID_OUTLINE = 'outline:none;';

/**
 * Get instance of OccConfigInfo
 *
 * @param {IModelObject} prodCtxt - product context
 * @param {Boolean} isNowUsed - indicates whether to use Now for DateEffectivity
 */
export let prepareOccConfigInfo = function( prodCtxt, isNowUsed ) {
    var effDate = prodCtxt.props.awb0EffDate.dbValues[0];
    var unitEffty = 0;

    // If global revision rule is defined on the product context, send the revision rule as null from client, on server it will read the rule from preference.
    var revRule;
    if ( prodCtxt.props.awb0UseGlobalRevisionRule && prodCtxt.props.awb0UseGlobalRevisionRule.dbValues.length > 0 &&
        prodCtxt.props.awb0UseGlobalRevisionRule.dbValues[0] === '1' ) {
        revRule = null;
    } else {
        revRule = cdm.getObject( prodCtxt.props.awb0CurrentRevRule.dbValues[0] );
    }

    var endItem = cdm.getObject( prodCtxt.props.awb0EffEndItem.dbValues[0] );
    var variantRule = cdm.getObject( prodCtxt.props.awb0CurrentVariantRule.dbValues[0] );
    var configurationObject = cdm.getObject( prodCtxt.props.awb0ContextObject.dbValues[0] );
    var svrOwningProduct = cdm.getObject( prodCtxt.props.awb0VariantRuleOwningRev.dbValues[0] );

    return {
        revisionRule: revRule ? revRule : {
            type: 'unknownType',
            uid: 'AAAAAAAAAAAAAA'
        },
        effectivityDate: effDate ? effDate : dateTimeSrv.NULLDATE,
        now: isNowUsed,
        endItem: endItem ? endItem : {
            type: 'unknownType',
            uid: 'AAAAAAAAAAAAAA'
        },
        unitNo: unitEffty,
        variantRule: variantRule ? variantRule : {
            type: 'unknownType',
            uid: 'AAAAAAAAAAAAAA'
        },
        configurationObject: configurationObject ? configurationObject : {
            type: 'unknownType',
            uid: 'AAAAAAAAAAAAAA'
        },
        svrOwningProduct: svrOwningProduct ? svrOwningProduct : {
            type: 'unknownType',
            uid: 'AAAAAAAAAAAAAA'
        }
    };
};

/**
 * Get Input context.
 *
 * @return {String} input object
 */
export let getInputContext = function( requestPreferences ) {
    let requestPref = requestPreferences;
    if( !requestPreferences ) {
        const baseURL = browserUtils.getBaseURL() + fmsUtils.getFMSUrl();
        requestPref = {
            base_url: baseURL
        };
    }

    var prodCtxt = occMgmtStateHandler.getProductContextInfo();
    var occConfigInfo = null;
    if ( prodCtxt ) {
        occConfigInfo = exports.prepareOccConfigInfo( prodCtxt, false );
    }
    return exports.prepareInputContext( occConfigInfo, PAGE_SIZE, null, prodCtxt, requestPref );
};

/**
 * Retrives the saved working context uid
 *
 * @returns {object}  savedWorkingContext  savedWorking Context
 */
export let getWorkingContextUid = function() {
    let savedWorkingContextUid = null;
    let occmgmtContext = appCtxService.getCtx( 'occmgmtContext' );
    if( occmgmtContext && occmgmtContext.workingContextObj ) {
        savedWorkingContextUid = occmgmtContext.workingContextObj.uid;
    }
    return savedWorkingContextUid;
};

/**
 * function to check if view mode has been changed in diagramming context
 * @returns {boolean} viewModeChanged
 */

export let viewModeChanged = function() {
    var viewModeChanged = false;
    var currentView = _.get( appCtxService, 'ctx.requirementDocumentation.currentViewMode', undefined );
    var nextView = _.get( appCtxService, 'ctx.ViewModeContext.ViewModeContext', undefined );
    if ( nextView && currentView !== nextView && ( nextView === 'SummaryView' || nextView === 'TableSummaryView' || nextView === 'TreeSummaryView' ) ) {
        viewModeChanged = true;
    }
    return viewModeChanged;
};
export let updateViewMode = function() {
    var viewMode = _.get( appCtxService, 'ctx.ViewModeContext.ViewModeContext', undefined );
    if ( viewMode ) {
        _.set( appCtxService, 'ctx.requirementDocumentation.currentViewMode', viewMode );
    }
};

/**
 * This method is use to iterate the specSegmentArray and return SpecSegmentContent which match with occurrence
 * uid.
 *
 * @param {String} content content
 * @param {String} occId uid of the occurrence
 * @return {Object} SpecSegmentContent which has occurrence with divID
 */
export let _getSpecSegmentContentFromDivId = function( content, occId ) {
    var specContents = content.specContents;
    if ( specContents ) {
        var newOccId = !specContents.some( occurrenceId => occurrenceId.occurrence.uid === occId );
        if( newOccId ) {
            return  occId;
        }
        for ( var index = 0; index < specContents.length; index++ ) {
            var specSegmentContent = specContents[index];
            var occurrence = specSegmentContent.occurrence;
            if ( occId === occurrence.uid ) {
                return specSegmentContent;
            }
        }
    }
    return null;
};
/**
 * Get the Input context object from the given inputs
 *
 * @param {IJSO} occConfigInfo - occurrence configuration information
 * @param {Integer} pageSize - number of occurrences in a page
 * @param {IModelObject} structureContext - structure context
 * @param {IModelObject} productContext - product context
 * @param {Map} requestPref - preference for the processing like filter
 *
 */

export let prepareInputContext = function( occConfigInfo, pageSize, structureContext, productContext, requestPref ) {
    if ( !structureContext ) {
        structureContext = {
            type: 'unknownType',
            uid: 'AAAAAAAAAAAAAA'
        };
    }
    if ( !productContext ) {
        return {
            configuration: occConfigInfo,
            pageSize: pageSize,
            structureContextObject: structureContext,
            productContext: productContext,
            requestPref: requestPref
        };
    }
    return {
        configuration: occConfigInfo,
        pageSize: pageSize,
        structureContextObject: structureContext,
        productContext: {
            type: productContext.type,
            uid: productContext.uid
        },
        requestPref: requestPref
    };
};

var _getDefaultInputContext = function() {
    return {
        configuration: {
            revisionRule: {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            },
            effectivityDate: '',
            now: false,
            endItem: {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            },
            unitNo: 0,
            variantRule: {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            },
            configurationObject: {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            },
            svrOwningProduct: {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            }
        },
        pageSize: 0,
        structureContextObject: {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        },
        productContext: {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        },
        requestPref: {}
    };
};
/**
 * Prepares the next fetch cursor data
 *
 * @param {IModelObject} productContext product context
 * @param {Integer} pageSize page size
 * @param {Boolean} goForward whether to fetch next set of requirements or previous set
 * @param curTopBottomInfo current Top Bottom Info
 */
export let getCursorInfoForNextFetch = function( curCursor, pageSize, goForward, curTopBottomInfo ) {
    if ( curCursor ) {
        var newCursor = curCursor;
        newCursor.contextInfo = {
            uid: curCursor.contextInfo.uid,
            type: curCursor.contextInfo.type
        };

        newCursor.inputCtxt.productContext = {
            uid: curCursor.inputCtxt.productContext.uid,
            type: curCursor.inputCtxt.productContext.type
        };

        newCursor.pageSize = pageSize;
        newCursor.startOcc = {
            uid: curTopBottomInfo.startOcc.uid,
            type: curTopBottomInfo.startOcc.type
        };
        newCursor.endOcc = {
            uid: curTopBottomInfo.endOcc.uid,
            type: curTopBottomInfo.endOcc.type
        };

        return {
            cursor: newCursor,
            goForward: goForward
        };
    }
};
/**
 * Prepares the next fetch cursor data
 *
 * @param {IModelObject} productContext product context
 * @param {Integer} pageSize page size
 * @param {Boolean} goForward whether to fetch next set of requirements or previous set
 */
export let getCursorInfoForFirstFetch = function( productContext, pageSize, goForward, inputCtxt, selectObj ) {
    if ( !inputCtxt ) {
        inputCtxt = _getDefaultInputContext();
    }
    var startOcc = selectObj ? selectObj : {
        uid: 'AAAAAAAAAAAAAA',
        type: 'unknownType'
    };
    var cursor1 = {
        contextInfo: {
            uid: productContext.uid,
            type: productContext.type
        },
        firstLevelOnly: true,
        pageSize: pageSize,
        endOcc: {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        },
        startOcc: startOcc,
        parentOccurrences: [],
        inputCtxt: inputCtxt
    };
    return {
        cursor: cursor1,
        goForward: goForward
    };
};
var _createReadOnlyDiv = function() {
    var readOnlyDiv = document.createElement( 'div' );
    readOnlyDiv.className = 'aw-requirement-readOnly';
    return readOnlyDiv;
};

/**
 * Create the div element with markers.
 *
 * @param {String} objectType object type string
 * @param {Object} typeIconElement - type icon
 * @param {String} objectUid - uid
 * @param {Object} data - view model data
 * @param {Boolean} isDerived - is derived
 * @param {Boolean} isBasedOn - is based on
 * @param {String} masterreqname - master requirement name
 * @param {String} basedOnMasterReqName - based on master requirement name
 * @return {Object} marker div element
 */
var _createMarkerDiv = function( typeIconElement, objectUid, data, isDerived, isBasedOn, masterreqname, basedOnMasterReqName, masterReqUid, basedonmasterreqid, typeObjectDiplayName, isSpecViewer ) {
    var markerDiv = document.createElement( 'div' );
    markerDiv.className = 'aw-requirement-marker';

    addObjectTypeIcon( markerDiv, typeIconElement, typeObjectDiplayName );
    addCheckedOutIcon( markerDiv, objectUid );

    if ( appCtxService.ctx.preferences && appCtxService.ctx.preferences.AWC_hide_CKEditor_add_command === undefined ) {
        addElementIcon( markerDiv );
    } else {
        if ( appCtxService.ctx.preferences && appCtxService.ctx.preferences.AWC_hide_CKEditor_add_command[0] === 'false' ) {
            addElementIcon( markerDiv );
        }
    }
    if ( appCtxService.ctx.preferences && appCtxService.ctx.preferences.AWC_hide_CKEditor_tracelink_command === undefined ) {
        addTracelinkIcon( markerDiv, objectUid, data, isDerived, isBasedOn, masterreqname, basedOnMasterReqName, masterReqUid, basedonmasterreqid, isSpecViewer );
    } else {
        if ( appCtxService.ctx.preferences.AWC_hide_CKEditor_tracelink_command[0] === 'false' ) {
            addTracelinkIcon( markerDiv, objectUid, data, isDerived, isBasedOn, masterreqname, basedOnMasterReqName, masterReqUid, basedonmasterreqid, isSpecViewer );
        }
    }

    return markerDiv;
};

/**
 * Add element describes type icon.
 *
 * @param {Object} markerDiv - marker div element
 * @param {String} objectType object type string
 * @param {Object} typeIconElement - type icon element
 *
 */
var addObjectTypeIcon = function( markerDiv, typeIconElement, typeObjectDiplayName ) {
    // Add place holder for "Type" icon to marker
    var typeIconPlaceHolder = document.createElement( 'typeIcon' );
    //Use type object display name to show on tooltip
    typeIconPlaceHolder.title = typeObjectDiplayName;
    markerDiv.appendChild( typeIconPlaceHolder );

    // Add type icon element
    typeIconPlaceHolder.appendChild( typeIconElement );
};

/**
 * Add check-out indicator icon.
 *
 * @param {Object} markerDiv - marker div element
 * @param {String} objectUid object id
 */
var addCheckedOutIcon = function( markerDiv, objectUid ) {
    var checkedOutPlaceHolder = document.createElement( 'checkedOut' );
    markerDiv.appendChild( checkedOutPlaceHolder );
};

/**
 * Add element describes tracelink  icon.
 *
 * @param {Object} markerDiv - marker div element
 * @param {String} objectUid - uid
 * @param {Object} data - view model data
 * @param {Boolean} isDerived - is derived
 * @param {Boolean} isBasedOn - is based on
 * @param {String} masterreqname - master requirement name
 * @param {String} basedOnMasterReqName - based on master requirement name
 */
var addTracelinkIcon = function( markerDiv, objectUid, data, isDerived, isBasedOn, masterreqname, basedOnMasterReqName, masterReqUid, basedonmasterreqid, isSpecViewer ) {
    var modelObject = cdm.getObject( objectUid );
    var hasTracelink = false;
    if ( modelObject && modelObject.props && modelObject.props.awb0TraceLinkFlag ) {
        if ( modelObject.props.awb0TraceLinkFlag.dbValues[0] === '1' || modelObject.props.awb0TraceLinkFlag.dbValues[0] === '2' ) {
            hasTracelink = true;
        }
        if ( !hasTracelink && data.content.specContents && data.content.specContents.length > 0 ) { //&& data.content.specContents[0].tracelinkInfo){
            for ( var j = 0; j < data.content.specContents.length; j++ ) {
                if ( data.content.specContents[j].occurrence.uid === objectUid && data.content.specContents[j].tracelinkInfo ) {
                    var complyingLinksInfoLength = data.content.specContents[j].tracelinkInfo.complyingLinksInfo.length;
                    var definingLinksInfoLength = data.content.specContents[j].tracelinkInfo.definingLinksInfo.length;
                    hasTracelink = Boolean( complyingLinksInfoLength > 0 || definingLinksInfoLength > 0 );
                }
            }
        }
    }

    if ( !data.hideTracelink ) {
        //Add place holder for "Tracelink" icon to marker
        var tracelinkIconPlaceHolder = document.createElement( 'tracelinkIcon' );
        tracelinkIconPlaceHolder.className = 'aw-requirement-sidebar-icon';
        tracelinkIconPlaceHolder.classList.add( 'aw-commands-commandIconButton' );
        markerDiv.appendChild( tracelinkIconPlaceHolder );

        tracelinkIconPlaceHolder.addEventListener( 'click', function( evt ) {
            setTimeout( function() {
                var eventData = {
                    sourceObject: {
                        uid: objectUid
                    }
                };
                eventBus.publish( 'requirementDocumentation.addObjectToTracelinkPanel', eventData );
            }, 500 );
        }, objectUid );

        var hasTracelinkElement = null;
        var resource = 'RichTextEditorCommandPanelsMessages';
        var localeTextBundle = localeService.getLoadedText( resource );

        if ( hasTracelink || isDerived || isBasedOn ) {
            tracelinkIconPlaceHolder.classList.add( 'aw-requirement-has-tracelink' );
            hasTracelinkElement = document.createElement( 'span' );
            if ( hasTracelink && modelObject.props.awb0IsSuspect && modelObject.props.awb0IsSuspect.dbValues[0] === '1' ) {    // show suspect icon if suspect flag is true
                hasTracelinkElement.innerHTML = _getImageIconElement( 'indicatorSuspectLink16.svg', localeTextBundle.indicatorSuspectLink, isSpecViewer );
            } else {
                hasTracelinkElement.innerHTML = _getImageIconElement( 'indicatorTraceLink16.svg', localeTextBundle.indicatorTraceLink, isSpecViewer );
            }

            tracelinkIconPlaceHolder.appendChild( hasTracelinkElement.firstElementChild );
            tracelinkIconPlaceHolder.classList.add( 'aw-requirement-traceLinkIconButton' );

            var noOfTracelink = _getTracelinkCountFromContent( data, objectUid );

            if ( noOfTracelink ) {
                var noOfTracelinkElement = document.createElement( 'div' );
                noOfTracelinkElement.className = 'aw-requirement-tracelinkCount';
                noOfTracelinkElement.appendChild( document.createTextNode( noOfTracelink ) );
                tracelinkIconPlaceHolder.appendChild( noOfTracelinkElement );
            }
        } else {
            tracelinkIconPlaceHolder.title = data.i18n.createTraceLinkTitle;
            tracelinkIconPlaceHolder.classList.add( 'aw-requirement-create-tracelink' );
            tracelinkIconPlaceHolder.innerHTML = _getImageIconElement( 'cmdCreateTraceLink24.svg', localeTextBundle.createTraceLink, isSpecViewer );
            tracelinkIconPlaceHolder.classList.add( 'aw-requirement-traceLinkIconButton' );
        }
        if ( hasTracelinkElement ) {
            hasTracelinkElement.addEventListener( 'mouseover', function( evt ) {
                var placeholder = evt.target;
                var delay = setTimeout( function() {
                    var rect = placeholder.getBoundingClientRect();
                    var iconDimension = {
                        offsetHeight: rect.height,
                        offsetLeft: rect.left,
                        offsetTop: rect.top,
                        offsetWidth: rect.width
                    };

                    var eventData = {
                        sourceObject: {
                            uid: objectUid,
                            isBasedon: isBasedOn,
                            masterReqName: masterreqname,
                            isderived: isDerived,
                            basedOnMasterReqName: basedOnMasterReqName,
                            masterReqUid: masterReqUid,
                            basedonmasterreqid: basedonmasterreqid
                        },
                        targetElement:placeholder,
                        commandDimension: iconDimension
                    };

                    eventBus.publish( 'requirementDocumentation.setTooltipContentData', eventData );
                }, 200 );

                placeholder.addEventListener( 'mouseout', function( evt1 ) {
                    clearTimeout( delay );
                } );
            }, objectUid );
        }
    }
};

/**
 * Add element describes add element icon.
 *
 * @param {Object} markerDiv marker div element
 */
var addElementIcon = function( markerDiv ) {
    // Add place holder for "Add Element" icon to marker
    var addElementPlaceHolder = document.createElement( 'addElementIcon' );
    markerDiv.appendChild( addElementPlaceHolder );
};

/**
 * Get Type Icon URL.
 *
 * @param {String} type - type.
 * @return Object
 */

export let getTypeIconURL = function( type ) {
    return iconService.getTypeIconURL( type );
};

/**
 * Get chevron Icon element
 *.
 * @return{Object} - svg element
 */

export let getChevronIcon = function() {
    return MiscExpand;
};
var _getChevronIconCollapse = function() {
    return MiscCollapse;
};

/**
 * Collapse or Expand the given requirement
 *
 * @param {Object} requirementElement - requirement dom element.
 */

export let collapseRequirement = function( requirementElement ) {
    var collapseFlag;

    var chevronElement = requirementElement.getElementsByClassName( 'aw-layout-panelSectionTitleChevron' );
    if ( chevronElement[0].classList.contains( 'aw-requirement-chevronCollapsed' ) ) {
        // If already Collapsed, expand it
        chevronElement[0].classList.remove( 'aw-requirement-chevronCollapsed' );
        chevronElement[0].innerHTML = exports.getChevronIcon();
        collapseFlag = false;
    } else {
        // If not Collapsed, collapse it
        chevronElement[0].classList.add( 'aw-requirement-chevronCollapsed' );
        chevronElement[0].innerHTML = _getChevronIconCollapse();
        collapseFlag = true;
    }

    var contentElements = requirementElement.getElementsByClassName( 'aw-requirement-content' );
    if ( contentElements && contentElements.length > 0 ) {
        if ( collapseFlag ) {
            contentElements[0].style.display = 'none';
            if ( !appCtxService.ctx.collapsedRequirements ) {
                appCtxService.ctx.collapsedRequirements = {};
            }
            appCtxService.ctx.collapsedRequirements[requirementElement.id] = true;
        } else {
            contentElements[0].style.display = 'block';
            delete appCtxService.ctx.collapsedRequirements[requirementElement.id];
        }
    }
};

/**
 * Check ctx to see given requirement was already collapsed.
 *
 * @param {Object} requirementElement - requirement dom element.
 */

export let checkCollapsedState = function( requirementElement ) {
    if ( appCtxService.ctx.collapsedRequirements && appCtxService.ctx.collapsedRequirements[requirementElement.id] ) {
        var contentElements = requirementElement.getElementsByClassName( 'aw-requirement-content' );
        contentElements[0].style.display = 'none';
        var chevronElement = requirementElement.getElementsByClassName( 'aw-layout-panelSectionTitleChevron' );
        chevronElement[0].classList.add( 'aw-requirement-chevronCollapsed' );
        chevronElement[0].innerHTML = _getChevronIconCollapse();
    }
};

/**
 * get object of type from collection
 *
 * @param modelObjects collection of objects.
 * @param objType objType.
 * @return result object
 */
export let getObjectOfType = function( modelObjects, objType ) {
    if ( modelObjects ) {
        var arrKey = Object.keys( modelObjects );

        for ( var i = 0; i < arrKey.length; i++ ) {
            var key = arrKey[i];
            var modelObj = modelObjects[key];

            if ( modelObj.type === objType ) {
                return modelObj;
            }
        }
    }
    return null;
};
/**
 * get Revision Object.
 *
 * @param {Object} obj - Awb0Element or revision object
 * @return {Object} Revision Object
 */
export let getRevisionObject = function( obj ) {
    var revObject = null;

    if ( commandsMapService.isInstanceOf( 'Awb0Element', obj.modelType ) ) {
        revObject = cdm.getObject( obj.props.awb0UnderlyingObject.dbValues[0] );
    } else {
        revObject = obj;
    }

    return revObject;
};

/**
 * Parse the contents and apply some styles for non-editable requirements
 *
 * @param contents mixed contents
 * @return formated contents
 */
var _updateDivWithStyleAttribute = function( divElement, styleName ) {
    var styleAttr = divElement.getAttribute( 'style' );
    if ( styleAttr !== null && styleAttr !== '' ) {
        if( !styleAttr.endsWith( ';' ) ) {
            styleAttr += ';';
        }
        styleAttr += styleName;
    } else {
        styleAttr = styleName;
    }
    divElement.setAttribute( 'style', styleAttr );
};

/**
 * Parse the contents and apply some styles for non-editable requirements
 *
 * @param contents mixed contents
 * @return formated contents
 */
export let checkForReadOnlyContents = function( data, contents ) {
    var htmlPanel = document.createElement( 'div' );
    htmlPanel.innerHTML = contents;

    var nodeList = htmlPanel.getElementsByClassName( 'requirement' );
    for ( var i = 0; i < nodeList.length; i++ ) {
        var divElement = nodeList[i];
        exports.setReadOnlyForRequirement( data, divElement );
    }

    return htmlPanel.innerHTML;
};

/**
 * Parse the bodytext and apply some styles for non-editable requirements
 *
 * @param {Object} data viewModel data
 * @param {Object} divElement requirement html element
 * @param {Object} reqBodyText bodytext html element
 * @returns {Boolean} isModifiable marker div element is modifiable
 */
export let setReadOnlyForBodyText = function( data, divElement, reqBodyText, isMultipleReq ) {
    var isModifiable = true;
    var hasNoFullText = reqBodyText.getAttribute( 'isEmpty' );
    var contentTypeAttr = reqBodyText.getAttribute( 'contentType' );
    var isDerived = reqBodyText.getAttribute( 'isDerived' );
    var isOverwrite = reqBodyText.getAttribute( 'isOverwrite' );
    if ( contentTypeAttr !== null && contentTypeAttr !== '' ) {
        if ( contentTypeAttr.toUpperCase() === 'WORD' ) {
            reqBodyText.setAttribute( 'title', data.i18n.wordReqCanNotBeEdited );
            isModifiable = false;
        }

        if ( contentTypeAttr.toUpperCase() === 'READONLY' ) {
            reqBodyText.setAttribute( 'title', data.i18n.readOnlyReqCanNotBeEdited );
            isModifiable = false;
        }
    }
    if ( isMultipleReq && hasNoFullText !== null && hasNoFullText.toUpperCase() === 'TRUE' ) {
        isModifiable = false;
    }
    if ( isDerived !== null && isDerived.toUpperCase() === 'TRUE' && !isOverwrite ) {
        isModifiable = false;
    }
    if ( !isModifiable ) {
        reqBodyText.setAttribute( 'contenteditable', 'false' );
        if( divElement ) {
            divElement.classList.add( 'aw-requirements-readOnlyRequirementContent' );
        }
    }
    return isModifiable;
};

/**
 * Parse the content and apply some styles for non-editable requirement
 *
 * @param {Object} data viewModel data
 * @param {Object} divElement requirement html element
 */
export let setReadOnlyForRequirement = function( data, divElement ) {
    divElement.setAttribute( 'contenteditable', 'false' );
    var isModifiable = true;

    var reqContent = divElement.getElementsByClassName( 'aw-requirement-content' )[0];
    if ( reqContent ) {
        // Add style to avoid outline for editable divs.
        _updateDivWithStyleAttribute( divElement, STYLES_TO_AVOID_OUTLINE );

        var reqBodyText = reqContent.getElementsByClassName( 'aw-requirement-bodytext' )[0];
        if ( reqBodyText ) {
            isModifiable = exports.setReadOnlyForBodyText( data, divElement, reqBodyText, true );
        }
    }

    var reqHeader = divElement.getElementsByClassName( 'aw-requirement-header' )[0];
    var id = divElement.getAttribute( 'id' );
    if ( appCtxService.ctx.selected.uid === id ) {
        reqHeader.setAttribute( 'selected', 'true' );
    } else {
        reqHeader.setAttribute( 'selected', 'false' );
    }

    var headerTypeAttribute = reqHeader.getAttribute( 'contentType' );
    if ( headerTypeAttribute.toUpperCase() === 'TITLE' ) {
        //Add style for read-only requirements.

        let reqId = reqHeader.getElementsByClassName( 'aw-requirement-headerId' );
        reqId[0].classList.add( 'aw-requirement-headerNonEditable' );
        reqId[0].setAttribute( 'contenteditable', 'false' );
        let reqTitleElement = reqHeader.getElementsByClassName( 'aw-requirement-title' );
        reqTitleElement[0].classList.add( 'aw-requirement-properties' );
        reqTitleElement[0].setAttribute( 'internalname', 'object_name' );

        if ( appCtxService.ctx.occmgmtContext && ( reqHeader.parentElement.id === appCtxService.ctx.occmgmtContext.topElement.uid || !isModifiable ) ) {
            reqTitleElement[0].setAttribute( 'contenteditable', 'false' );
        } else {
            reqTitleElement[0].setAttribute( 'contenteditable', 'true' );
        }
        let parentSpan = document.createElement( 'span' );
        parentSpan.appendChild( reqTitleElement[0].cloneNode( true ) );
        reqId[0].parentElement.replaceChild( parentSpan, reqTitleElement[0] );

        reqHeader.setAttribute( 'contenteditable', 'false' );
    }
};

/**
 * This function update the type icon and tracelink icon in the contents.
 *
 * @param {Object} htmlPanel - html contents DOM element
 * @param {Object} data - panel's view model object
 * @param {Boolean} checkForReadOnlyContents - if true, check requirement div for readonly
 * @return {Object} updated DOM element
 */
export let updateMarkers = function( htmlPanel, data, checkForReadOnlyContents, isSpecViewer, isCKCollaborationSetupDone, isOwnerIdPresentAtCollaboration ) {
    var nodeList = htmlPanel.getElementsByTagName( 'div');
    let specDataAttributeMap = [];
    let specOLEDataMap = [];
    let specImageDataMap = [];
    for ( const element of nodeList ) {
        var divElement = element;
        if( isOwnerIdPresentAtCollaboration ) {
            divElement.setAttribute( 'ownerid', isOwnerIdPresentAtCollaboration );
        }
        if ( divElement.classList.contains( 'requirement' ) ) {
            // Check if no script in html
            var sanitizedHtml = sanitizer.sanitizeHtmlValue( divElement.innerHTML );
            if( sanitizedHtml !== divElement.innerHTML ) {
                // There is a problem in html
                var dummyReqContentHtml = '<div class="aw-requirement-header" contentType="TITLE"><h3 contenteditable="false"><span class="aw-requirement-headerNonEditable">REQ_TITLE</span></h3></div><div class="aw-requirement-content"><div class="aw-requirement-bodytext" contenteditable="false"></div></div>';
                divElement.innerHTML = dummyReqContentHtml.replace( 'REQ_TITLE', sanitizedHtml );
                continue;
            }
            if ( checkForReadOnlyContents ) {
                exports.setReadOnlyForRequirement( data, divElement );
            }
            var objectType = divElement.getAttribute( 'objectType' );
            var objectUid = divElement.getAttribute( 'id' );

            var revisionElementObject = cdm.getObject( objectUid );
            if ( revisionElementObject ) {
                var revObject = exports.getRevisionObject( revisionElementObject );
                if ( revObject ) {
                    var revObjectUid = revObject.uid;
                    divElement.setAttribute( 'revisionid', revObjectUid );
                }
            }

            var wrapper = document.createElement( 'div' );
            var typeObjectDiplayName;
            var typeObjectModelType = cmm.getType( objectType );
            if ( typeObjectModelType ) {
                typeObjectDiplayName = typeObjectModelType.displayName;
            }

            var typeIconElementStr;
            if ( revisionElementObject ) {
                var customTypeIconUrl = awIconService.getTypeIconFileUrl( revisionElementObject );
                if ( customTypeIconUrl ) {
                    typeIconElementStr = _getImageIconElementFromUrl( customTypeIconUrl, typeObjectDiplayName );
                } else {
                    typeIconElementStr = getIconStringForObjectsWithoutRevision( objectType );
                }
            } else {
                typeIconElementStr = getIconStringForObjectsWithoutRevision( objectType );
            }

            wrapper.innerHTML = typeIconElementStr;

            let bodyTextAttributes = {};

            var typeIconElement = wrapper.firstChild;
            var bodyText = divElement.getElementsByClassName( 'aw-requirement-bodytext' );
            var isDerived;
            var isBasedOn;
            var masterreqname;
            var masterReqUid;
            var basedonmasterreqid;
            var basedOnMasterReqName;
            if ( bodyText && bodyText.length > 0 ) {
                isDerived = bodyText[0].getAttribute( 'isDerived' );
                isBasedOn = bodyText[0].getAttribute( 'isBasedOn' );
                masterreqname = bodyText[0].getAttribute( 'masterreqname' );
                masterReqUid = bodyText[0].getAttribute( 'masterReqUid' );
                basedonmasterreqid = bodyText[0].getAttribute( 'basedonmasterreqid' );
                basedOnMasterReqName = bodyText[0].getAttribute( 'basedOnMasterReqName' );
                var isOverwrite = bodyText[0].getAttribute( 'isOverwrite' );
                var isMasterChanged = bodyText[0].getAttribute( 'isMasterChanged' );
                var isFrozen = bodyText[0].getAttribute( 'isFrozen' );
                var readonlyElement;
                if ( isDerived ) {
                    readonlyElement = _createReadOnlyDiv();
                    if ( isMasterChanged ) {
                        readonlyElement.classList.add( 'aw-requirements-masterChanged' );
                        readonlyElement.setAttribute( 'title', data.i18n.FrozenToNonLatestTooltip );
                    } else if ( isOverwrite ) {
                        readonlyElement = _createReadOnlyDiv();
                        readonlyElement.classList.add( 'aw-requirements-editable' );
                        readonlyElement.setAttribute( 'title', data.i18n.overwrittenTooltip );
                        divElement.insertBefore( readonlyElement, divElement.firstChild );
                    } else if( isFrozen && !isMasterChanged ) {
                        readonlyElement.classList.add( 'aw-requirements-frozenToLatest' );
                        readonlyElement.setAttribute( 'title', data.i18n.FrozenToLatestTooltip );
                    } else {
                        readonlyElement.classList.add( 'aw-requirements-readOnly' );
                        readonlyElement.setAttribute( 'title', data.i18n.UnfrozenTooltip );
                    }
                    divElement.insertBefore( readonlyElement, divElement.firstChild );
                }

                if( isCKCollaborationSetupDone ) {
                    // Cache Attributes
                    bodyTextAttributes.contenteditable = bodyText[0].getAttribute( 'contenteditable' );
                    if( bodyText[0].hasAttribute( 'contenttype' ) ) {
                        bodyTextAttributes.contenttype = bodyText[0].getAttribute( 'contenttype' );
                    }
                    if( bodyText[0].hasAttribute( 'title' ) ) {
                        bodyTextAttributes.title = bodyText[0].getAttribute( 'title' );
                    }
                    // Cache Image SRC - file ticket
                    var nodeList = bodyText[0].getElementsByTagName( 'img' );
                    for ( var j = 0; j < nodeList.length; j++ ) {
                        var imgEle = nodeList[j];
                        var alt = imgEle.getAttribute( 'alt' );
                        var src = imgEle.getAttribute( 'src' );
                        if( imgEle.hasAttribute( 'oleid' ) ) {
                            //datasetfileticket
                            specOLEDataMap[imgEle.getAttribute( 'oleid' )] = {
                                datasetfileticket : imgEle.getAttribute( 'datasetfileticket' ),
                                src : imgEle.getAttribute( 'src' )
                            };
                        } else if( alt && src && alt !== '' && src !== '' ) {
                            specImageDataMap[alt] = src;
                        }
                    }
                }
            }
            var markerDivElement = _createMarkerDiv( typeIconElement, objectUid, data, isDerived, isBasedOn, masterreqname, basedOnMasterReqName, masterReqUid, basedonmasterreqid, typeObjectDiplayName
                , isSpecViewer );

            // Insert marker div element to the requirement div
            divElement.insertBefore( markerDivElement, divElement.firstChild );
            // Add attribute if it is top line
            // 'parentid' attribute will be missing for top line element
            var parentID = divElement.getAttribute( 'parentid' );
            if ( parentID === null || parentID === undefined || parentID === '' ) {
                divElement.setAttribute( 'TOP_LINE', 'true' );
            } else if ( data.removeWidgets ) {
                var removeElementPlaceHolder = document.createElement( 'removeElementIcon' );
                markerDivElement.appendChild( removeElementPlaceHolder );
            }

            let reqTitleAttributes = {};
            let reqTitleElement = divElement.getElementsByClassName( 'aw-requirement-title' );
            if( reqTitleElement.length > 0 && reqTitleElement[0].hasAttribute( 'contenteditable' ) ) {
                reqTitleAttributes.contenteditable = reqTitleElement[0].getAttribute( 'contenteditable' );
            }

            if( isCKCollaborationSetupDone ) {
                const specContent = getSpecContentFromRevisinID( data.content.specContents, divElement.getAttribute( 'revisionid' ) );
                const fullTextUID = specContent && specContent.fulltext ? specContent.fulltext.uid : undefined;
                specDataAttributeMap[divElement.getAttribute( 'revisionid' )] = {
                    id: divElement.getAttribute( 'id' ),
                    parentid: divElement.getAttribute( 'parentid' ),
                    bodytext: bodyTextAttributes,
                    header: reqTitleAttributes,
                    fulltext: fullTextUID
                };
            }
        }
    }
    if (isCKCollaborationSetupDone) {
        var nodeList1 = htmlPanel.getElementsByTagName('loading');
        for (const element of nodeList1) {
            var divElement = element;
            specDataAttributeMap[divElement.getAttribute('revisionid')] = {
                id: divElement.getAttribute('id'),
                parentid: divElement.getAttribute('parentid')
            };
        }
    }


    if( isCKCollaborationSetupDone ) {
        ckeditorOperations.setSpecDataAttributesMap( specDataAttributeMap );
        ckeditorOperations.setSpecImageDataMap( specImageDataMap );
        ckeditorOperations.setSpecOLEDataMap( specOLEDataMap );
    }

    return htmlPanel;
};

/**
 * Function to get SpecContent from revID
 * @param {Array} specContents -
 * @param {String} revId  -
 * @returns {Object} -
 */
function getSpecContentFromRevisinID( specContents, revId ) {
    for ( const element of specContents ) {
        const obj = element;
        if( obj.specElemRevision.uid === revId ) {
            return obj;
        }
    }
}

var getIconStringForObjectsWithoutRevision = ( objectType ) => {
    var typeIconElementStr;
    var typeObject = cmm.getType( objectType );
    if ( typeObject ) {
        var typeIconFileName = cmm.getTypeIconFileName( typeObject );
        typeIconElementStr = iconService.getTypeIconFileTag( objectType, typeIconFileName );
    }
    if ( !typeIconElementStr ) {
        typeIconElementStr = iconService.getTypeIcon( 'MissingImage' );
    }
    return typeIconElementStr;
};

/**
 * Get InputData.
 *
 * @param {IModelObject} rootOccurrence root occurrence
 * @param {IJSO} inputContext input context
 * @param {Boolean} firstLevelOnly first level only?
 * @param {Boolean} startFreshNavigation start fresh navigation?
 * @param {IJSO} getNextChildOccurrencesData next occurrence data
 * @param {Boolean} isEditMode is edit mode
 */
export let prepateSpecificationSegmentInput = function( rootOccurrence, inputContext, firstLevelOnly,
    startFreshNavigation, getNextChildOccurrencesData, isEditMode ) {
    var options = [];
    if ( firstLevelOnly ) {
        options.push( 'FirstLevelOnly' );
    }
    if ( isEditMode ) {
        options.push( 'EditMode' );
    }
    if ( startFreshNavigation ) {
        options.push( 'StartFreshNavigation' );
    }
    var inputPayload = {
        inputCtxt: inputContext,
        nextOccData: getNextChildOccurrencesData,
        inputObjects: [ {
            uid: rootOccurrence.uid
        } ],
        options: options
    };
    return {
        inputData: inputPayload
    };
};

export let getRequirementElementsFromUids = function( modelObjects, editMode, editor ) {
    var widgetData = editor.model.document.getRoot();

    var objectDivElements = [];
    for ( var iinstance = 0; iinstance < widgetData.childCount; iinstance++ ) {
        var selectedElement = widgetData.getChild( iinstance );
        var idSelEle = selectedElement.getAttribute( 'id' );

        var reqElement = cdm.getObject( idSelEle );
        var reqRevisionUid;
        if ( reqElement && reqElement.props && reqElement.props.awb0UnderlyingObject ) {
            reqRevisionUid = reqElement.props.awb0UnderlyingObject.dbValues[0];
        }
        var matches = _.filter( modelObjects, function( obj ) {
            return obj.uid === idSelEle || reqRevisionUid && obj.uid === reqRevisionUid;
        } );
        if ( matches && matches.length ) {
            objectDivElements.push( selectedElement );
        }
    }
    return objectDivElements;
};

/**
 * Get the requirement div elements from the DOM.
 *
 * @param {IModelObject} modelObjects- array of modelObjects
 * @param {boolean} editMode - is Documentation tab in edit mode
 * @param {Object} editor - editor
 * @return {Object} list of dom elements
 */
export let getRequirementDivElementsFromUids = function( modelObjects, editMode, editor ) {
    var requirementDivs = [];
    if ( !editMode ) {
        requirementDivs = document.querySelectorAll( 'div.requirement' );
    } else if ( editor.document && editor.document.$ ) {
        requirementDivs = editor.document.$.querySelectorAll( 'div.requirement' );
    }

    var objectDivElements = [];
    for ( var i = 0; i < requirementDivs.length; i++ ) {
        var selectedElement = requirementDivs[i];
        var reqElement = cdm.getObject( selectedElement.id );
        var reqRevisionUid;
        if ( reqElement && reqElement.props && reqElement.props.awb0UnderlyingObject ) {
            reqRevisionUid = reqElement.props.awb0UnderlyingObject.dbValues[0];
        }
        var matches = _.filter( modelObjects, function( obj ) {
            return obj.uid === selectedElement.id || reqRevisionUid && obj.uid === reqRevisionUid;
        } );
        if ( matches && matches.length ) {
            objectDivElements.push( selectedElement );
        }
    }

    return objectDivElements;
};

var _getTracelinkElement = function( editor, reqElement ) {
    const range = editor.model.createRangeIn( reqElement );
    for ( const modelElement of range.getItems( { ignoreElementEnd: true } ) ) {
        if ( modelElement.name ===  'tracelinkicon' ) {
            return modelElement;
        }
    }
    return null;
};

var _getBodyTextElement = function( editor, reqElement ) {
    const range = editor.model.createRangeIn( reqElement );
    for ( const modelElement of range.getItems( { ignoreElementEnd: true } ) ) {
        if ( modelElement.name === 'requirementBodyText' ) {
            return modelElement;
        }
    }
    return null;
};

/**
 * Update the tracelink markers of requirement element based on updated property value.
 * TODO :: Need to refactor similar functions
 * @param {Object} reqElement - requirement dom element
 */
export let updateTracelinkMarkerEle = function( data, reqElement, editor ) {
    var bodyText = _getBodyTextElement( editor, reqElement );
    var isDerived;
    var isBasedOn;
    if ( bodyText ) {
        isDerived = bodyText.getAttribute( 'isDerived' );
        isBasedOn = bodyText.getAttribute( 'isBasedon' );
    }
    var reqEleId = reqElement.getAttribute( 'id' );
    var reqElementMO = cdm.getObject( reqEleId );
    var reqRevisionMO;
    if ( reqElementMO && reqElementMO.props && reqElementMO.props.awb0UnderlyingObject ) {
        reqRevisionMO = cdm.getObject( reqElementMO.props.awb0UnderlyingObject.dbValues[0] );
    }
    var hasTracelink = false;
    if ( reqRevisionMO && reqRevisionMO.props && reqRevisionMO.props.has_trace_link ) {
        hasTracelink = reqRevisionMO.props.has_trace_link.dbValues[0] === '1';
    } else if ( reqElementMO && reqElementMO.props && reqElementMO.props.awb0TraceLinkFlag ) {
        if ( reqElementMO.props.awb0TraceLinkFlag.dbValues[0] === '1' || reqElementMO.props.awb0TraceLinkFlag.dbValues[0] === '2' ) {
            hasTracelink = true;
        }
    }
    var noOfTracelink = _getTracelinkCountFromContent( data, reqEleId );
    if ( noOfTracelink !== null && noOfTracelink > 0 ) {
        hasTracelink = true;
    }else{
        hasTracelink = false;
    }

    var tracelinkIconPlaceHolder = _getTracelinkElement( editor, reqElement );

    if ( tracelinkIconPlaceHolder ) {
        var classList = tracelinkIconPlaceHolder.getAttribute( 'class' );
        let svgname = 'cmdCreateTraceLink';
        var title = tracelinkIconPlaceHolder.getAttribute( 'title' );

        if ( hasTracelink ) {
            svgname = 'indicatorTraceLink';
            classList = classList.replace( 'aw-requirement-create-tracelink', 'aw-requirement-has-tracelink' );
        } else {
            noOfTracelink = '';
            if ( isDerived || isBasedOn ) {
                classList.replace( 'aw-requirement-create-tracelink', 'aw-requirement-has-tracelink' );
                svgname = 'indicatorTraceLink';
            } else if ( classList.indexOf( 'aw-requirement-create-tracelink' ) === -1 ) {
                classList.replace( 'aw-requirement-has-tracelink', 'aw-requirement-create-tracelink' );

                title = data.i18n.createTraceLinkTitle;
                svgname = 'cmdCreateTraceLink';
            }
        }

        editor.editing.model.change( writer => {
            writer.setAttribute( 'class', classList, tracelinkIconPlaceHolder );
            writer.setAttribute( 'svgname', svgname, tracelinkIconPlaceHolder );
            writer.setAttribute( 'iconname', svgname, tracelinkIconPlaceHolder );
            writer.setAttribute( 'tracelinkCount', noOfTracelink, tracelinkIconPlaceHolder );
            writer.setAttribute( 'title', title, tracelinkIconPlaceHolder );
        } );
    }
};

/**
 * Update the tracelink markers of requirement element based on updated property value.
 *
 * @param {Object} reqElement - requirement dom element
 */
export let updateTracelinkMarker = function( data, reqElement ) {
    var bodyText = reqElement.getElementsByClassName( 'aw-requirement-bodytext' );
    var isDerived;
    var isBasedOn;
    if ( bodyText && bodyText.length > 0 ) {
        isDerived = bodyText[0].getAttribute( 'isDerived' );
        isBasedOn = bodyText[0].getAttribute( 'isBasedon' );
    }
    var reqElementMO = cdm.getObject( reqElement.id );
    var reqRevisionMO;
    if ( reqElementMO && reqElementMO.props && reqElementMO.props.awb0UnderlyingObject ) {
        reqRevisionMO = cdm.getObject( reqElementMO.props.awb0UnderlyingObject.dbValues[0] );
    }
    var hasTracelink = false;
    if ( reqRevisionMO && reqRevisionMO.props && reqRevisionMO.props.has_trace_link ) {
        hasTracelink = reqRevisionMO.props.has_trace_link.dbValues[0] === '1';
    } else if ( reqElementMO && reqElementMO.props && reqElementMO.props.awb0TraceLinkFlag ) {
        if ( reqElementMO.props.awb0TraceLinkFlag.dbValues[0] === '1' || reqElementMO.props.awb0TraceLinkFlag.dbValues[0] === '2' ) {
            hasTracelink = true;
        }
    }
    var noOfTracelink = _getTracelinkCountFromContent( data, reqElement.id );
    if ( noOfTracelink !== null && noOfTracelink > 0 ) {
        hasTracelink = true;
    }

    var tracelinkIconPlaceHolder = reqElement.getElementsByTagName( 'tracelinkIcon' );
    var resource = 'RichTextEditorCommandPanelsMessages';
    var localeTextBundle = localeService.getLoadedText( resource );

    if ( tracelinkIconPlaceHolder && tracelinkIconPlaceHolder.length > 0 ) {
        if ( hasTracelink ) {
            if ( !tracelinkIconPlaceHolder[0].classList.contains( 'aw-requirement-has-tracelink' ) ) {
                tracelinkIconPlaceHolder[0].classList.remove( 'aw-requirement-create-tracelink' );
                tracelinkIconPlaceHolder[0].classList.add( 'aw-requirement-has-tracelink' );
                tracelinkIconPlaceHolder[0].innerHTML = _getImageIconElement( 'indicatorTraceLink16.svg', localeTextBundle.indicatorTraceLink );
            }

            // Reset tracelink count
            if ( noOfTracelink !== null && noOfTracelink !== 0 ) {
                var tracelinkCountElement = tracelinkIconPlaceHolder[0].getElementsByClassName( 'aw-requirement-tracelinkCount' );
                if ( tracelinkCountElement && tracelinkCountElement.length > 0 ) {
                    tracelinkCountElement[0].innerHTML = noOfTracelink === 0 ? '' : noOfTracelink;
                } else {
                    //create count indicator
                    tracelinkIconPlaceHolder[0].classList.add( 'aw-requirement-traceLinkIconButton' );
                    var noOfTracelinkElement = document.createElement( 'div' );
                    noOfTracelinkElement.className = 'aw-requirement-tracelinkCount';
                    noOfTracelinkElement.appendChild( document.createTextNode( noOfTracelink ) );
                    tracelinkIconPlaceHolder[0].appendChild( noOfTracelinkElement );
                }
            } else {
                tracelinkIconPlaceHolder[0].classList.remove( 'aw-requirement-has-tracelink' );
                tracelinkIconPlaceHolder[0].classList.add( 'aw-requirement-create-tracelink' );
                tracelinkIconPlaceHolder[0].title = data.i18n.createTraceLinkTitle;
                tracelinkIconPlaceHolder[0].innerHTML = _getImageIconElement( 'cmdCreateTraceLink24.svg', localeTextBundle.createTraceLink );
            }
        } else {
            if ( isDerived || isBasedOn ) {
                tracelinkIconPlaceHolder[0].classList.remove( 'aw-requirement-create-tracelink' );
                tracelinkIconPlaceHolder[0].classList.add( 'aw-requirement-has-tracelink' );
                tracelinkIconPlaceHolder[0].innerHTML = _getImageIconElement( 'indicatorTraceLink16.svg', localeTextBundle.indicatorTraceLink );
            } else if ( !tracelinkIconPlaceHolder[0].classList.contains( 'aw-requirement-create-tracelink' ) ) {
                tracelinkIconPlaceHolder[0].classList.remove( 'aw-requirement-has-tracelink' );
                tracelinkIconPlaceHolder[0].classList.add( 'aw-requirement-create-tracelink' );
                tracelinkIconPlaceHolder[0].title = data.i18n.createTraceLinkTitle;
                tracelinkIconPlaceHolder[0].innerHTML = _getImageIconElement( 'cmdCreateTraceLink24.svg', localeTextBundle.createTraceLink );
            }
        }
    }
};

/**
 * Get Input object.
 *
 * @param {Object} ctx - ctx
 * @return {Object} object
 */
export let getTopSelectedObject = function( ctx ) {
    var selectObj = ctx.selected;
    if ( selectObj.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1 ||
         selectObj.modelType.typeHierarchyArray.indexOf( 'Att1AttributeAlignmentProxy' ) > -1 ) {
        selectObj = ctx.pselected;
    }
    var lastParent = selectObj;
    while ( selectObj ) {
        var parentModelObject = null;

        if ( selectObj.modelType && selectObj.modelType.typeHierarchyArray && ( selectObj.modelType.typeHierarchyArray.indexOf( 'Arm0RequirementElement' ) > -1 || selectObj.modelType.typeHierarchyArray.indexOf( 'Arm0ParagraphElement' ) > -1 || selectObj.modelType.typeHierarchyArray.indexOf( 'Arm0RequirementSpecElement' ) > -1 ) ) {
            lastParent = selectObj;
        }
        if ( selectObj && selectObj.props && selectObj.props.awb0Parent && selectObj.props.awb0Parent.dbValues[0] ) {
            var parentObjUID = selectObj.props.awb0Parent.dbValues[0];
            parentModelObject = cdm.getObject( parentObjUID );
        }
        selectObj = parentModelObject;
    }
    return {
        uid: lastParent.uid,
        type: lastParent.type
    };
};

/**
 * Load object properties from the tracelink info
 *
 * @param {Object} modelObject - type name
 * @param {Array} propNames - property names to be loaded
 */
var _loadObjectProps = function( modelObjects, propNames ) {
    var deferred = AwPromiseService.instance.defer();
    reqUtils.loadModelObjects( modelObjects, propNames ).then( function() {
        deferred.resolve();
    } );
    return deferred.promise;
};
/**
 * Return the tracelink count from Spec content information
 *
 * @param {Object} data - view model object data
 * @param {String} occUid - uid of occurrance
 */
var _getTracelinkCountFromContent = function( data, occUid ) {
    // Get SpecContent data from all pages
    var specContentData = [];
    if ( data.content && data.content.specContents ) {
        specContentData = data.content.specContents;
    }

    if ( specContentData.length > 0 && occUid ) {
        var tracelinkInfo;

        // Get specContent for given element
        for ( var i = 0; i < specContentData.length; i++ ) {
            var specContent = specContentData[i];
            if ( specContent && specContent.occurrence && specContent.occurrence.uid === occUid ) {
                tracelinkInfo = specContent.tracelinkInfo;
                if ( tracelinkInfo.numOfLinks > 0 ) {
                    var loadObjects = [];
                    var propNames = [ 'items_tag' ];
                    // Defining Links
                    for ( var i = 0; i < tracelinkInfo.definingLinksInfo.length; i++ ) {
                        var definingLinkInfo = tracelinkInfo.definingLinksInfo[i];
                        var modelObject = cdm.getObject( definingLinkInfo.obj.uid );
                        if ( !definingLinkInfo.obj.props.items_tag ) {
                            loadObjects.push( modelObject );
                        }
                    }
                    // Complying Links
                    for ( var i = 0; i < tracelinkInfo.complyingLinksInfo.length; i++ ) {
                        var complyingLinkInfo = tracelinkInfo.complyingLinksInfo[i];
                        var modelObject = cdm.getObject( complyingLinkInfo.obj.uid );
                        if ( !complyingLinkInfo.obj.props.items_tag ) {
                            loadObjects.push( modelObject );
                        }
                    }
                    if ( loadObjects.length > 0 ) { _loadObjectProps( loadObjects, propNames ); }
                }
                return tracelinkInfo.numOfLinks === '' ? null : tracelinkInfo.numOfLinks;
            }
        }
    }
};

/**
 * Check if String start with given prefix
 *
 * @param str the input string
 * @param prefix prefix
 * @return true/false
 */
var _startsWith = function( str, prefix ) {
    return str.indexOf( prefix ) === 0;
};

/**
 * Check if String end at given suffix
 *
 * @param str the input string
 * @param prefix prefix
 * @return true/false
 */
var _endsWith = function( str, suffix ) {
    return str.match( suffix + '$' ) === suffix;
};
/**
 * Make sure that CSS class names are valid - in this case, that they do not start with a numeral. Modify such
 * instances so they begin with an underscore. This method was added to fix defect D-17331. When this issue is
 * fixed on the server by prepending UIDs with an underscore or otherwise fixing the UID-classnames, this method
 * can be removed. Only public so accessible for Mockito mocking.
 *
 * @param html the input HTML string
 * @return the corrected HTML string
 */
export let correctCSSClassNames = function( html ) {
    //D-18254 IE ONLY FIX - Monkey bind JS built in classes so that they strictly compare Strings.

    // For each found match of the regex, match.index is the start of the match and regex.lastIndex
    // is the end of the match.  Slice from the previous end up to the start and append that string
    // onto the end of the new string.  Then append the altered match onto the new string.
    if ( !html ) {
        return '';
    }

    var newStr = '';
    var exp = '((\\.)(\\d[_\\-0-9a-zA-Z]+)(\\s+\\{))|((class=\\")(\\d[_\\-0-9a-zA-Z]+)(\\"))';
    var regex = new RegExp( exp, 'g' );
    var start = 0;
    var end = 0;
    var match;
    match = regex.exec( html );
    while ( match ) {
        start = match.index;
        newStr += html.slice( end, start ); // Placement of this line is important.
        end = regex.lastIndex;

        if ( _startsWith( match[0], '.' ) && _endsWith( match[0], '{' ) ) {
            newStr += '._' + match[0].substring( 1 );
        } else if ( _startsWith( match[0], 'class=' ) && _endsWith( match[0], '"' ) ) {
            newStr += 'class="_' + match[0].substring( 7 );
        }
        match = regex.exec( html );
    }
    newStr += html.slice( end );

    return newStr;
};
export let getCompareInput = function( ctx, data ) {
    data.trgSelection = null;
    data.srcSelection = null;
    if ( ctx.mselected.length > 1 ) {
        data.trgSelection = ctx.mselected[1];
        data.srcSelection = ctx.mselected[0];
    } else {
        data.trgSelection = exports.getRevisionObject( ctx.CompareTrg.baseSelection );
        data.srcSelection = exports.getRevisionObject( ctx.CompareSrc.baseSelection );
    }

    var srcPwaSelectionModel = ctx.CompareSrc ? ctx.CompareSrc.pwaSelectionModel : null;
    var trgPwaSelectionModel = ctx.CompareTrg ? ctx.CompareTrg.pwaSelectionModel : null;

    if ( srcPwaSelectionModel && srcPwaSelectionModel.getSelection() && srcPwaSelectionModel.getSelection().length > 0 ) {
        data.srcSelection = cdm.getObject( srcPwaSelectionModel.getSelection()[0] );
    }
    if ( trgPwaSelectionModel && trgPwaSelectionModel.getSelection() && trgPwaSelectionModel.getSelection().length > 0 ) {
        data.trgSelection = cdm.getObject( trgPwaSelectionModel.getSelection()[0] );
    }

    return [ {
        objectsToExport: [ data.srcSelection ],
        targetObjectsToExport: [ data.trgSelection ],
        templateName: 'REQ_default_spec_template',
        applicationFormat: 'MSWordCompare',
        exportOptions: [],
        recipeSourceObjects: [],
        recipeTargetObjects: [],
        attributesToExport: [],
        objectTemplateInputs: [],
        includeAttachments: false
    } ];
};

var _getImageIconElement = function( fileName, altText, specViewer ) {
    if( specViewer ) {
        if( fileName === 'indicatorTraceLink16.svg' ) {
            return indicatorTraceLink;
        } else if( fileName === 'cmdCreateTraceLink24.svg' ) {
            return cmdCreateTraceLink;
        }
    }
    if( fileName === 'indicatorTraceLink16.svg' ) {
        return '<span iconname="indicatorTraceLink"/>';
    } else if( fileName === 'cmdCreateTraceLink24.svg' ) {
        return '<span iconname="cmdCreateTraceLink"/>';
    }else if( fileName === 'indicatorSuspectLink16.svg' ) {
        return '<span iconname="indicatorSuspectLink"/>';
    }
};

var _getImageIconElementFromUrl = function( imgUrl, displayName ) {
    return '<img class="aw-base-icon aw-aria-border" src="' + imgUrl + '" alt="' + displayName + '" tabindex = "0" />';
};
/*
 * Register ctx to decide command visibility of derived commands
 *
 */
export let registerCtxForDerivedCommands = function() {
    var isDerivedSpec = appCtxService.getCtx( 'isDerivedSpecOpened' );
    if( isDerivedSpec ) {
        var selObjects = [];
        var selectedRequirementObjects = [];
        var selectedUid = appCtxService.getCtx( 'mselected' );
        var editorId = appCtxService.getCtx( 'AWRequirementsEditor' ).id;
        var editor = ckeditorOperations.getCKEditorInstance( editorId, appCtxService.ctx );
        for ( var index = 0; index < selectedUid.length; index++ ) {
            if( editor.document ) {
                var domReq = editor.document.$.getElementById( selectedUid[index].uid );
            }else{
                var domReq = document.getElementById( selectedUid[index].uid );
            }
            selectedRequirementObjects.push( createSourceObject( domReq ) );
            var reqElement = cdm.getObject( selectedUid[index].uid );
            selObjects.push( reqElement );
        }
        var isReqSpecSelected = arm0ShowActionPanel.isObjectOfType( selObjects, 'Arm0RequirementSpecElement' );
        var derivedObjectMetadata = arm0ShowActionPanel.getDerivedObjectMetadata( selectedRequirementObjects );
        if( derivedObjectMetadata.isOverwrite && !isReqSpecSelected ) {
            appCtxService.registerCtx( 'isDeriveCommandVisible', false );
            appCtxService.registerCtx( 'hideUnfreezeCommand', true );
        } else if( isReqSpecSelected ) {
            appCtxService.registerCtx( 'isDeriveCommandVisible', false );
            appCtxService.registerCtx( 'hideUnfreezeCommand', true );
        }else if(  ( derivedObjectMetadata.isFrozen || derivedObjectMetadata.isMasterChanged ) && !isReqSpecSelected ) {
            appCtxService.registerCtx( 'isDeriveCommandVisible', true );
            appCtxService.registerCtx( 'hideUnfreezeCommand', false );
        } else {
            appCtxService.registerCtx( 'isDeriveCommandVisible', true );
            appCtxService.registerCtx( 'hideUnfreezeCommand', true );
        }
    }
};
/**
 *Creates source object input
 * @param {*} domReq
 */
function createSourceObject( domReq ) {
    var bodyTextElement = domReq.getElementsByClassName( 'aw-requirement-bodytext' );
    var isDerived = bodyTextElement && bodyTextElement[0].getAttribute( 'isDerived' );
    var isFrozen = bodyTextElement && bodyTextElement[0].getAttribute( 'isFrozen' );
    var isOverwrite =  bodyTextElement && bodyTextElement[ 0 ].getAttribute( 'isOverwrite' );
    var isMasterChanged =  bodyTextElement && bodyTextElement[ 0 ].getAttribute( 'isMasterChanged' );

    return {
        uid: domReq.id,
        isFrozen: isFrozen,
        isDerived: isDerived,
        isOverwrite:isOverwrite,
        isMasterChanged:isMasterChanged
    };
}


export let loadSavedTrackchnagesData = function( markUpData ) {
    var markupTrackchange = new Map();
    var jsonArrayOFTrackChnage = [];
    var objs;
    for ( var ind = 0; ind < markUpData.length; ind++ ) {
        var json = markUpData[ind].markups;
        var commentList = [];
        var escaped = json.replace( /[\u007f-\uffff]/g, function( c ) {
            return '\\u' + ( '0000' + c.charCodeAt( 0 ).toString( 16 ) ).slice( -4 );
        } );
        objs = JSON.parse( escaped, function( key, value ) {
            return key === 'date' ? new Date( value ) :
                key === 'geometry' && typeof value === 'string' ? JSON.parse( value ) : value;
        } );

        if( objs && objs.length > 0 ) {
            for ( var i = 0; i < objs.length; i++ ) {
                jsonArrayOFTrackChnage.push( objs[i] );

                // if ( !markupTrackchange.get( markUpData[ind].baseObject.uid ) ) {
                //     markupTrackchange.set(  markUpData[ind].baseObject.uid, [ objs[i] ] );
                // }else{
                //     markupTrackchange.get( markUpData[ind].baseObject.uid  ).push( objs[i] );
                // }
            }
        }
    }
    return jsonArrayOFTrackChnage;
};

//* sort trackchnages and comments saved data */
export let sortoutTrackChangesandComments =  function( savedtrackChangesandComments ) {
    var jsonArrayOFTrackChnage = [];
    var jsonArrayOfComments = [];

    //  _.forEach( savedtrackChangesandComments, function( savedtrackChangeComments ) {
    for ( var ind = 0; ind < savedtrackChangesandComments.length; ind++ ) {
        if( savedtrackChangesandComments[ind].reqData && savedtrackChangesandComments[ind].reqData.commentid ) {
            jsonArrayOfComments.push( savedtrackChangesandComments[ind] );
        }else{
            jsonArrayOFTrackChnage.push( savedtrackChangesandComments[ind] );
        }
        //  } );
    }
    rmCkeditorService.setInitialTrackChangeData( jsonArrayOFTrackChnage );
    rmCkeditorService.setInitialCommentsData( jsonArrayOfComments );
};


export default exports = {
    prepareOccConfigInfo,
    getInputContext,
    viewModeChanged,
    updateViewMode,
    _getSpecSegmentContentFromDivId,
    prepareInputContext,
    getCursorInfoForFirstFetch,
    getTypeIconURL,
    getChevronIcon,
    collapseRequirement,
    checkCollapsedState,
    getObjectOfType,
    getRevisionObject,
    checkForReadOnlyContents,
    setReadOnlyForRequirement,
    updateMarkers,
    prepateSpecificationSegmentInput,
    getRequirementDivElementsFromUids,
    updateTracelinkMarker,
    getTopSelectedObject,
    correctCSSClassNames,
    getCompareInput,
    getCursorInfoForNextFetch,
    getRequirementElementsFromUids,
    updateTracelinkMarkerEle,
    getWorkingContextUid,
    registerCtxForDerivedCommands,
    setReadOnlyForBodyText,
    loadSavedTrackchnagesData,
    sortoutTrackChangesandComments
};
