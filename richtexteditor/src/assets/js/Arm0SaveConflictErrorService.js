// Copyright (c) 2023 Siemens

/**
 * Service
 *
 * @module js/Arm0SaveConflictErrorService
 */
import appCtxSvc from 'js/appCtxService';
import ckeditorOperations from 'js/ckeditorOperations';
import AwHttpService from 'js/awHttpService';
import browserUtils from 'js/browserUtils';
import reqUtils from 'js/requirementsUtils';
import cdm from 'soa/kernel/clientDataModel';
import fmsUtils from 'js/fmsUtils';
import soaSvc from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';

let exports = {};
let tempDocument = document.implementation.createHTMLDocument( 'Test Doc1' );
const ARM0_YOUR_UNSAVED_CHANGES = 'Arm0YourUnsavedChangesData';
const ARM0_OTHERS_SAVED_CHANGES = 'Arm0OthersSavedChangesData';
var TC_MICRO_PREFIX = 'tc/micro';
var RM_COMPARE_HTML = '/req_compare/v1/compare/html';

export let keepChangesDoneByOthersInfoInSessionStorage = function( conflictingRequirementUIDs ) {
    let deferred = AwPromiseService.instance.defer();
    let unsavedChagesArray = [];
    let uidsArray = [];
    // Get Original Content from ckeditor5Utils
    conflictingRequirementUIDs.forEach( revUID => {
        let occUID = ckeditorOperations.getCKEditorModelElementUIDByRevID( revUID );
        let originalContent = ckeditorOperations.getOriginalReqHtmlFromUID( occUID );
        const originalObj = getContentFromDomRequirementEle( originalContent );

        uidsArray.push( revUID );
        unsavedChagesArray.push( {
            revID: revUID,
            lastModUser: getLastModifiedUser( revUID ),
            originalContent: originalObj.bodyText,
            originalObjectString: originalObj.objectString
        } );
    } );

    if( uidsArray.length > 0 ) {
        // Call SOA to get latest contents
        _callSOAToLoadLatestContents( uidsArray ).then( function( udatedObj ) {
            unsavedChagesArray.forEach( obj => {
                obj.updatedContent = udatedObj[obj.revID].bodyText;
                obj.updatedObjectString = udatedObj[obj.revID].objectString;
            } );
            // update Session storage
            if( unsavedChagesArray.length > 0 ) {
                sessionStorage.setItem( ARM0_OTHERS_SAVED_CHANGES, JSON.stringify( unsavedChagesArray ) );
                deferred.resolve( true );
            }
        } );
    } else {
        deferred.resolve( false );
    }
    return deferred.promise;
};

export let keepYourUnsavedChangesInfoInSessionStorage = function( conflictingRequirementUIDs ) {
    let unsavedChagesArray = [];
    // Get Original Content from ckeditor5Utils
    conflictingRequirementUIDs.forEach( revUID => {
        let editor = ckeditorOperations.getCKEditorInstance( );
        let occUID = ckeditorOperations.getCKEditorModelElementUIDByRevID( revUID );
        let originalContent = ckeditorOperations.getOriginalReqHtmlFromUID( occUID );
        const originalObj = getContentFromDomRequirementEle( originalContent );

        let ckeditorModelElement = ckeditorOperations.getCKEditorModelElementByUID( occUID );
        if( ckeditorModelElement ) {
            let reqDivHTML = editor.data.stringify( ckeditorModelElement );
            const udatedObj = getContentFromDomRequirementEle( reqDivHTML );
            if( udatedObj && udatedObj.bodyText ) {
                unsavedChagesArray.push( {
                    revID: revUID,
                    originalContent: originalObj.bodyText,
                    originalObjectString: originalObj.objectString,
                    updatedContent: udatedObj.bodyText,
                    updatedObjectString: udatedObj.objectString
                } );
            }
        }
    } );
    // update Session storage
    if( unsavedChagesArray.length > 0 ) {
        sessionStorage.setItem( ARM0_YOUR_UNSAVED_CHANGES, JSON.stringify( unsavedChagesArray ) );
        return true;
    }
    return false;
};

function getLastModifiedUser( revID ) {
    let mo = cdm.getObject( revID );
    if( mo && mo.props && mo.props.last_mod_user ) {
        return mo.props.last_mod_user.uiValues[0];
    }
}

/**
 *
 * @param {*} reqDomElement
 * @returns
 */
function getContentFromDomRequirementEle( reqDomContent ) {
    let reqDomElement = tempDocument.createElement( 'div' );
    reqDomElement.innerHTML = reqDomContent;

    let bodyTextDiv = reqDomElement.getElementsByClassName( 'aw-requirement-bodytext' );
    let headerIDEle = reqDomElement.getElementsByClassName( 'aw-requirement-headerId' );
    let titleEle = reqDomElement.getElementsByClassName( 'aw-requirement-title' );
    if( bodyTextDiv.length > 0 ) {
        let headerText = headerIDEle[0].innerText;
        headerText = headerText.split( ' ' )[headerText.split( ' ' ).length - 1];
        return {
            bodyText: bodyTextDiv[0].innerHTML,
            objectString: headerText + titleEle[0].innerText
        };
    }
}

export let revealCompareReport = function() {
    const state = appCtxSvc.getCtx( 'state' );
    let specData;
    if( state && state.params && state.params.locale === 'changesDoneByOthers' ) {
        specData = sessionStorage.getItem( ARM0_OTHERS_SAVED_CHANGES );
    } else {
        specData = sessionStorage.getItem( ARM0_YOUR_UNSAVED_CHANGES );
    }

    // Compare
    const contents = _createSpecContent( JSON.parse( specData ) );

    let $http = AwHttpService.instance;
    let url = _getCompareHtmlServiceURL();
    $http.post( url, contents, {
        headers: { 'Content-Type': 'application/json' }
    } ).then( function( response ) {
        if( response.data && response.data.output ) {
            let reportElement = document.getElementsByClassName( 'aw-requirements-conflictCompareReportContent' );
            if( reportElement.length > 0 ) {
                reportElement[0].innerHTML = reqUtils.addCssInContents( response.data.output );
            }
        }
    } );
};

/**
 *
 * @param {Array} objArray -
 * @returns {Array} - Array of 2 spec content
 */
function _createSpecContent( objArray ) {
    // Create HTML Contents
    let originalContentSpec = tempDocument.createElement( 'div' );
    let updatedContentSpec = tempDocument.createElement( 'div' );
    objArray.forEach( obj => {
        // original
        const originalObjectString = obj.originalObjectString;
        const originalContent = obj.originalContent;
        const lastModUser = obj.lastModUser;
        const reqOriginalDiv = _createReqContent( originalObjectString, originalContent, lastModUser );
        // updated
        const updatedContent = obj.updatedContent;
        const updatedObjectString = obj.updatedObjectString;
        const reqUpdatedDiv = _createReqContent( updatedObjectString, updatedContent, lastModUser );
        originalContentSpec.append( reqOriginalDiv );
        updatedContentSpec.append( reqUpdatedDiv );
    } );

    return [ originalContentSpec.innerHTML, updatedContentSpec.innerHTML ];
}

/**
 *
 * @param {*} objectString - Object string
 * @param {*} content - Object Content
 * @returns {Object} - DOM Element
 */
function _createReqContent( objectString, content, lastModUser ) {
    let reqDiv = tempDocument.createElement( 'div' );
    let titleH3 = tempDocument.createElement( 'h3' );
    let titleSpan = tempDocument.createElement( 'span' );
    titleSpan.innerHTML = objectString;
    titleH3.append( titleSpan );
    if( lastModUser ) {
        let lmdSpan = tempDocument.createElement( 'span' );
        lmdSpan.classList.add( 'aw-requirements-compareReportLabel' );
        lmdSpan.innerHTML = lastModUser;
        titleH3.append( lmdSpan );
    }
    let contentDiv = tempDocument.createElement( 'div' );
    contentDiv.innerHTML = content;
    reqDiv.append( titleH3 );
    reqDiv.append( contentDiv );
    return reqDiv;
}

/**
 *
 * @returns {String} - Comare service URL
 */
function _getCompareHtmlServiceURL() {
    return browserUtils.getBaseURL() + TC_MICRO_PREFIX + RM_COMPARE_HTML;
}

let _callSOAToLoadLatestContents = function( uids ) {
    let deferred = AwPromiseService.instance.defer();
    const input = _getInputForLoadContentSOA( uids );
    let contentsArray = [];
    soaSvc.post( 'Internal-AWS2-2017-06-RequirementsManagement', 'exportToApplication3', input ).then( function( response ) {
        let htmlContents = response.transientFileReadTickets;
        for( let i = 0; i < htmlContents.length; i++ ) {
            const updatedObj = getContentFromDomRequirementEle( htmlContents[i] );
            contentsArray[uids[i]] = updatedObj;
        }
        deferred.resolve( contentsArray );
    } );
    return deferred.promise;
};

let _getInputForLoadContentSOA = function( uids ) {
    let inputObjects = [];
    uids.forEach( uid => {
        inputObjects.push( { uid: uid } );
    } );
    let baseUrl = browserUtils.getBaseURL() + fmsUtils.getFMSUrl();
    return { input: [ {
        templateName: '',
        applicationFormat: 'HTML',
        objectsToExport: inputObjects,
        targetObjectsToExport: [],
        exportOptions: [ {
            option: 'base_url',
            optionvalue: baseUrl
        }
        ],
        recipeSourceObjects: [],
        recipeTargetObjects: [],
        attributesToExport:[],
        objectTemplateInputs: [],
        includeAttachments: false
    } ] };
};

export default exports = {
    keepChangesDoneByOthersInfoInSessionStorage,
    keepYourUnsavedChangesInfoInSessionStorage,
    revealCompareReport
};
