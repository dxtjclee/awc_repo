// Copyright (c) 2022 Siemens

/**
 * Module for the Requirement wide panel page that
 * generate awb0ArchetypeRevName Property and attaching image and event listener to it
 *
 * @module propRenderTemplates/generateRmRevisionNameProperty
 */
import appCtxSvc from 'js/appCtxService';
import cmm from 'soa/kernel/clientMetaModel';

var exports = {};

/**
 * generate awb0ArchetypeRevName Property and attaching image and event listener to it
 * @param { Object } vmo - ViewModelObject of Summary Tab
 * @param { Object } containerElem - The container DOM Element inside which RevNameText and imgage will rendered
 */
export let generateRmArchetypeRevNameRendererFn = function( vmo, containerElem ) {
    var reqDashboardTable = appCtxSvc.getCtx( 'reqDashboardTable' );
    var revNameObj = null;
    var RevNameText = '';
    if ( vmo.props && vmo.props['REF(arm0SourceElement,Awb0ConditionalElement).awb0ArchetypeRevName'] ) {
        revNameObj = vmo.props['REF(arm0SourceElement,Awb0ConditionalElement).awb0ArchetypeRevName'];
    }
    if( cmm.isInstanceOf( 'Awb0Element', vmo.modelType ) && vmo.props.awb0ArchetypeRevName ) {
        revNameObj = vmo.props.awb0ArchetypeRevName;
    }
    if ( revNameObj && revNameObj.dbValues && revNameObj.dbValues.length > 0 ) {
        RevNameText = revNameObj.dbValues[0];
    }
    _renderRevNameIcon( vmo, containerElem, RevNameText );
};

/**
 * @param { Object } vmo - ViewModelObject of Summary Tab
 * @param { Object } containerElem -  The container DOM Element inside which RevNameText and imgage will rendered
 * @param {String} RevNameText - RevNameText
 */
var _renderRevNameIcon = function( vmo, containerElem, RevNameText ) {
    var textDiv = document.createElement( 'div' );
    if (containerElem.classList.contains('aw-splm-tableCellTopDynamic')) {
        textDiv.className = 'aw-splm-tableCellText aw-splm-tableCellTextDynamic';
    } else {
        textDiv.className = 'aw-splm-tableCellText';
    }
    textDiv.innerText = RevNameText;
    textDiv.title = RevNameText;
    var cellImg = document.createElement( 'img' );
    cellImg.className = 'aw-base-icon';
    cellImg.style = 'overflow: initial !important;';
    cellImg.src = vmo.typeIconURL;
    cellImg.alt = RevNameText;
    containerElem.appendChild( cellImg );
    containerElem.appendChild( textDiv );
};

export default exports = {
    generateRmArchetypeRevNameRendererFn
};
