// Copyright (c) 2022 Siemens

/**
 * @module js/Arm0LoadSpecService
 */
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import reqACEUtils from 'js/requirementsACEUtils';
import soaSvc from 'soa/kernel/soaService';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import rmCkeditorService from 'js/Arm0CkeditorService';

var exports = {};

var PAGE_SIZE = 3;
var content;


/**
 * Set content when documentation tab is loaded.
 *
 * @param {Object} data - The panel's view model object
 */
export let setDocumentationContent = function( data ) {
    content = data.content;
};

/**
 * Get content when documentation tab is loaded.
 */
export let getDocumentationContent = function() {
    return content;
};

/**
 * Get NextOccuraceData .
 *
 * @param {Object} data - view model data
 * @param {Object} ctx - ctx
 * @param {Object} inputCtxt -
 * @returns {Array} Next child occ data
 */
var _getNextOccuranceData = function( data, ctx, inputCtxt, selectedObject ) {
    var goForward = data.goForward;
    var curTopBottomInfo = {};
    var nextChildOccData = {};

    if( data.arm0PageUpOrDownAction ) {
        // Page Up/down
        curTopBottomInfo = {
            startOcc: data.content.cursor.startOcc,
            endOcc: data.content.cursor.endOcc
        };

        nextChildOccData = reqACEUtils.getCursorInfoForNextFetch( data.content.cursor, PAGE_SIZE, goForward,
            curTopBottomInfo );
    } else {
        // Its first time loading OR selection
        data.goForward = true;
        var prodCtxt = occMgmtStateHandler.getProductContextInfo();
        if( prodCtxt ) {
            nextChildOccData = reqACEUtils.getCursorInfoForFirstFetch( prodCtxt, PAGE_SIZE, data.goForward, inputCtxt, selectedObject );
        }
    }

    return nextChildOccData;
};

/**
 * Get Input data for getSpecificationSegmentInputForSelected.
 *
 * @param {Object} data - The panel's view model object
 * @param {Object} ctx - Application context
 * @returns {Object} - Json object
 */
export let getSpecificationSegmentInputForSelected = function( data, ctx, InitialContentLoad ) {
    return getSpecificationSegmentInput( data, ctx, InitialContentLoad );
};

/**
 * Get Input data for getSpecificationSegment.
 *
 * @param {Object} data - The panel's view model object
 * @param {Object} ctx - Application context
 * @returns {Object} - Json object
 */
export let getSpecificationSegmentInput = function( data, ctx, InitialContentLoad ) {
    // By default top element will be send as default input objects
    var topSelectObj = reqACEUtils.getTopSelectedObject( ctx );

    let cachedChecksum = rmCkeditorService.getChecksum();

    var selectObj = ctx.selected;
    if ( selectObj.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) > -1 ) {
        selectObj = ctx.pselected;
    }
    var inputCtxt = reqACEUtils.getInputContext();
    if( InitialContentLoad ) {
        if( ctx.user ) {
            inputCtxt.requestPref.default_user_icon = ctx.user.typeIconURL;
        }

        if( cachedChecksum && !data.arm0PageUpOrDownAction ) {
            inputCtxt.requestPref.concurrentEditMode = cachedChecksum;
        } else{
            inputCtxt.requestPref.concurrentEditMode = 'regenerateChecksum';
        }
    }
    return {
        inputCtxt: inputCtxt,
        inputObjects: [ topSelectObj ],
        nextOccData: _getNextOccuranceData( data, ctx, inputCtxt, selectObj ),
        options: [ 'FirstLevelOnly', 'EditMode' ]
    };
};

/**
 * Get Input data for getSpecificationSegment.
 *
 * @returns {Object} - Json object for SOA input
 */
export let getSpecificationSegmentInputForObjectsToLoad = function( uidsToLoad ) {
    var inputObjects = [];
    uidsToLoad.forEach( uid => {
        inputObjects.push( { uid: uid } );
    } );

    var inputCtxt = reqACEUtils.getInputContext();
    return {
        inputCtxt: inputCtxt,
        inputObjects: inputObjects,
        options: [ 'ExportContentWithTraceLinks' ]
    };
};

/**
 * Call SOA for getSpecificationSegment with Property Policy Override
 *
 * @param {Object} inputData Input Data for SOA call
 * @param {Object} propertyPolicyOverride Property Policy
 * @returns {Object} - Json object
 */
export let getSpecificationSegment = function( inputData, propertyPolicyOverride ) {
    return soaSvc.postUnchecked( 'Internal-AwReqMgmtSe-2019-06-SpecNavigation', 'getSpecificationSegment', inputData, propertyPolicyOverride );
};

export let getExportToApplication = function( createdUid ) {
    var inputObjects = [];
    createdUid.forEach( uid => {
        inputObjects.push( { uid: uid } );
    } );
    var baseUrl = browserUtils.getBaseURL() + fmsUtils.getFMSUrl();
    var input = {
        input:[
            {
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
            }
        ]  };
    return soaSvc.post( 'Internal-AWS2-2017-06-RequirementsManagement', 'exportToApplication3', input );
};


export default exports = {
    getSpecificationSegmentInput,
    getSpecificationSegment,
    setDocumentationContent,
    getDocumentationContent,
    getSpecificationSegmentInputForSelected,
    getSpecificationSegmentInputForObjectsToLoad,
    getExportToApplication
};
