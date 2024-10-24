// Copyright (c) 2022 Siemens

/**
 * Module for the Requirement wide panel page that
 * generate release_status_list Property and attaching image and event listener to it
 *
 * @module propRenderTemplates/generateRmReleaseStatusProperty
 * @requires app
 */
import { getBaseUrlPath } from 'app';
import cdm from 'soa/kernel/clientDataModel';
import navigationSvc from 'js/navigationService';

var exports = {};

/**
 * generate release_status_list Property and attaching image and event listener to it
 * @param { Object } vmo - ViewModelObject of Summary Tab or dashboard
 * @param { Object } containerElem - The container DOM Element inside which image will rendered
 */
export let generateRmReleaseStatusIconRendererFn = function( vmo, containerElem ) {
    var releaseStatus = null;
    if( vmo.props && vmo.props[ 'REF(awb0UnderlyingObject,WorkspaceObject).release_status_list' ] ) {
        releaseStatus = vmo.props[ 'REF(awb0UnderlyingObject,WorkspaceObject).release_status_list' ];
    } else if( vmo.props && vmo.props[ 'REF(arm0UnderlyingObject,ItemRevision).release_status_list' ] ) {
        releaseStatus = vmo.props[ 'REF(arm0UnderlyingObject,ItemRevision).release_status_list' ];
    }
    if( releaseStatus && releaseStatus.dbValues && releaseStatus.dbValues.length > 0 ) {
        _renderReleaseStatusIcon( containerElem, releaseStatus );
    }
};

/**
 * generate release_status_list Property and attaching image and event listener to it
 * @param { Object } vmo - ViewModelObject of Compare Table
 * @param { Object } containerElem - The container DOM Element inside which image will rendered
 */
export let compareObjectReleaseStatusRendererFn = function( vmo, containerElem ) {
    var releaseStatus = null;
    if( vmo.props && vmo.props.object_release_status ) {
        releaseStatus = vmo.props.object_release_status;
    }
    if( releaseStatus && releaseStatus.dbValue && releaseStatus.dbValue.length > 0 ) {
        if( releaseStatus.dbValue && releaseStatus.displayValues.length > 0 ) {
            var parentDiv = document.createElement( 'div' );
            parentDiv.className = 'aw-splm-tableCellText';
            let noOfRelease = releaseStatus.dbValue.toString().split( ',' );
            for( let index = noOfRelease.length - 1; index >= 0; index-- ) {
                var status = noOfRelease[index].trim();
                _getProperReleasestatusIconImg( status, index, releaseStatus, parentDiv );
            }
            containerElem.appendChild( parentDiv );
        }
    }
};

/**
 * @param { Object } containerElem -  The container DOM Element inside which image will rendered
 * @param {String} releaseStatus - releaseStatus
 */
var _renderReleaseStatusIcon = function( containerElem, releaseStatus ) {
    if( releaseStatus.dbValues ) {
        var parentDiv = document.createElement( 'div' );
        parentDiv.className = 'aw-splm-tableCellText';
        for( let index = 0; index < releaseStatus.dbValues.length; index++ ) {
            var modelObject = cdm.getObject( releaseStatus.dbValues[index] );
            var status = modelObject.props.object_name.dbValues[0];
            _getProperReleasestatusIconImg( status, index, releaseStatus, parentDiv );
        }
        containerElem.appendChild( parentDiv );
    }
};


/**
 * @param {status} status - dbValue of releaseStatus object
 * @param { index } index - index of releaseStatus object
 * @param {Object} releaseStatus - releaseStatus
 * @param {HTMLElement} parentDiv - Parent Div
 */
var _getProperReleasestatusIconImg = function( status, index, releaseStatus, parentDiv ) {
    var imgSrc;
    if( status === 'TC Baselined' || status === 'Baseline' ) {
        imgSrc = getBaseUrlPath() + '/image/indicatorReleasedTCBaselined16.svg';
        _renderReleaseStatusIconAndAttachEvent( index, imgSrc, releaseStatus, parentDiv );
    }
    if( status === 'TCM Released' ) {
        imgSrc = getBaseUrlPath() + '/image/indicatorReleasedTCMReleased16.svg';
        _renderReleaseStatusIconAndAttachEvent( index, imgSrc, releaseStatus, parentDiv );
    }
    if( status === 'Draft' ) {
        imgSrc = getBaseUrlPath() + '/image/indicatorDraft16.svg';
        _renderReleaseStatusIconAndAttachEvent( index, imgSrc, releaseStatus, parentDiv );
    }
    if( status === 'In Review' ) {
        imgSrc = getBaseUrlPath() + '/image/indicatorReadOnly16.svg';
        _renderReleaseStatusIconAndAttachEvent( index, imgSrc, releaseStatus, parentDiv );
    }
    if( status === 'Rejected' ) {
        imgSrc = getBaseUrlPath() + '/image/indicatorReleasedRejected16.svg';
        _renderReleaseStatusIconAndAttachEvent( index, imgSrc, releaseStatus, parentDiv );
    }
};


/**
 * @param { index } index - index of releaseStatus object
 * @param { Object } imgSrc -  image source
 * @param {Object} releaseStatus - releaseStatus
 * @param {HTMLElement} parentDiv - Parent Div
 */
var _renderReleaseStatusIconAndAttachEvent = function( index, imgSrc, releaseStatus, parentDiv ) {
    var cellImg1 = document.createElement( 'img' );
    var releaseStatusdbValue = releaseStatus.dbValues;
    cellImg1.className = 'aw-visual-indicator aw-commands-command aw-requirementsmanager-summaryTableIcon';
    cellImg1.title = releaseStatus.displayValues[ index ];
    if( !releaseStatusdbValue ) {
        releaseStatusdbValue = releaseStatus.dbValue;
    }
    cellImg1.setAttribute( 'objectUid', releaseStatusdbValue[ index ] );
    cellImg1.src = imgSrc;
    parentDiv.appendChild( cellImg1 );
};

export default exports = {
    generateRmReleaseStatusIconRendererFn,
    compareObjectReleaseStatusRendererFn
};
