// Copyright (c) 2022 Siemens

/**
 * native construct to hold the server version information related to the AW server release.
 *
 * @module propRenderTemplates/generateQualityStatusProperty
 */
import localeService from 'js/localeService';
import { svgString as cmdFilledStar } from 'image/cmdFilledStar24.svg';
import { svgString as cmdEmptyStar } from 'image/cmdEmptyStar24.svg';

var exports = {};
var localTextBundle = localeService.getLoadedText( 'RichTextEditorCommandPanelsMessages' );
/**
 * @param { Object } vmo - ViewModelObject
 * @param { Object } containerElem - The container DOM Element
 */
export let generateCorrectnessRendererFn = function( vmo, containerElem ) {
    if( vmo && vmo.props && vmo.props.qualityCorrectness && vmo.props.qualityCorrectness.value ) {
        if( vmo.props.qualityCorrectness.value === '3' ) {
            containerElem.innerHTML += _getFilledStarImgElement();
            containerElem.innerHTML += _getEmptyStarImgElement();
            containerElem.innerHTML += _getEmptyStarImgElement();
        } else if( vmo.props.qualityCorrectness.value === '2' ) {
            containerElem.innerHTML += _getFilledStarImgElement();
            containerElem.innerHTML += _getFilledStarImgElement();
            containerElem.innerHTML += _getEmptyStarImgElement();
        } else {
            containerElem.innerHTML += _getFilledStarImgElement();
            containerElem.innerHTML += _getFilledStarImgElement();
            containerElem.innerHTML += _getFilledStarImgElement();
        }
    }
};

var _getFilledStarImgElement = function() {
    return '<span style="height:16px;width:26px;padding-right:10px">' + cmdFilledStar + '<span/>';
};

var _getEmptyStarImgElement = function() {
    return '<span style="height:16px;width:26px;padding-right:10px">' + cmdEmptyStar + '<span/>';
};

export default exports = {
    generateCorrectnessRendererFn
};
