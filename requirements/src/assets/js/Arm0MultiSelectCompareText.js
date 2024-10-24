// Copyright (c) 2022 Siemens

/**
 * Module for the Requirement Compare Text
 *
 * @module js/Arm0MultiSelectCompareText
 */
import commandsMapService from 'js/commandsMapService';
import cdm from 'soa/kernel/clientDataModel';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import eventBus from 'js/eventBus';
import appCtxSvc from 'js/appCtxService';
import compareUtils from 'js/Arm0CompareUtils';
import reqUtils from 'js/requirementsUtils';
import _ from 'lodash';
import AwPromiseService from 'js/awPromiseService';

var exports = {};
var innerHTMLs = [];
var fileNames = [];
const reqSpecRev = 'RequirementSpec Revision';
const reqRev = 'Requirement Revision';
const paraRev = 'Paragraph Revision';
const arm0ReqRev = 'Arm0RequirementElement';
const arm0Para = 'Arm0ParagraphElement';
const arm0ReqSpecRev = 'Arm0RequirementSpecElement';
const requirementTypesArray = [ reqRev, arm0Para, arm0ReqRev, paraRev ];
const reqSpecTypesArray = [ arm0ReqSpecRev, reqSpecRev ];

/**
  * get Revision Object.
  *
  * @param {Object} ctx - ctx
  * @return {Array} Array of Revision Object
  */
export let getRevisionObject = function( ctx ) {
    var revObjects = [];
    fileNames = [];
    var objs = ctx.mselected;
    objs.forEach( ( obj ) => {
        if( commandsMapService.isInstanceOf( 'Awb0Element', obj.modelType ) ) {
            revObjects.push( cdm.getObject( obj.props.awb0UnderlyingObject.dbValues[ 0 ] ) );
        } else {
            revObjects.push( obj );
        }
        fileNames.push( constructFileName( obj ) );
    } );

    return revObjects;
};

/**
  * construct fileName.
  *
  * @param {Object} modelObject - Awb0Element or revision object
  * @return {String} file Name
  */
var constructFileName = function( modelObject ) {
    var fileName = {};
    var subString1 = '';
    var subString2 = '';
    modelObject.props.awp0CellProperties.dbValues.forEach( ( property )=> {
        subString1 = property.slice( 0, property.indexOf( '\\:' ) );
        subString2 = property.slice( property.indexOf( '\\:' ) + 2, property.length );
        fileName[subString1] = subString2;
    } );

    var keys = Object.keys( fileName );
    // keys will always be in below order
    // 0 - Name
    // 1 - ID
    // 2 - Revision
    return fileName[keys[1]] + '/' + fileName[keys[2]] + ';' + fileName[keys[0]];
};


/**
  * Here we get the HTML string of the content of the selected requirement and then extract the body of the requirement along with it's header.
  *
  * @param {Array} selectedObjsHTMLArray - HTML string of the content of selected requirements.
  */
export let postExportToApp3SOAResponse = function( selectedObjsHTMLArray ) {
    if ( selectedObjsHTMLArray && selectedObjsHTMLArray.length > 0 ) {
        innerHTMLs = [];
        selectedObjsHTMLArray.forEach( ( objHTML ) => {
            innerHTMLs.push( '<div>' + objParagraphText( objHTML ).trim() + '</div>' );
        } );
    }
    var crossCompare = appCtxSvc.getCtx( 'Arm0CrossCompare' );
    if ( innerHTMLs.length > 0 && !crossCompare ) {
        var compareData = {
            html1: innerHTMLs[0],
            html2: innerHTMLs[1]
        };
        compareUtils.syncSameImagesAndOLE( compareData );
        innerHTMLs[0] = compareData.html1;
        innerHTMLs[1] = compareData.html2;
        eventBus.publish( 'Arm0MultiSelectCompareText.compareHtmlVersion' );
    }
};

var objParagraphText = function( objHTMLContent ) {
    var template = document.createElement( 'template' );
    template.innerHTML = objHTMLContent;
    var element = template.content.children[0];
    return element.getElementsByClassName( 'aw-requirement-bodytext' )[0].innerHTML;
};


/**
  * get Compare HTML service URL.
  *
  * @return {String} url of html microservice.
  */
export let getCompareHtmlServiceURL = function() {
    return compareUtils.getCompareHtmlServiceURL();
};

/*
  * get getExport Options
  *
  * @return {Object}
  */
export let getExportOptions = function() {
    var exportOptions = [];
    var baseURL = browserUtils.getBaseURL() + fmsUtils.getFMSUrl();
    var requestPref = {
        option: 'base_url',
        optionvalue: baseURL
    };
    exportOptions.push( requestPref );
    var compare = {
        option: 'COMPARE_TEXT',
        optionvalue: 'COMPARE_TEXT'
    };
    exportOptions.push( compare );

    return exportOptions;
};


/**
  * get Compare HTML service URL.
  *
  * @return {Array} array of the contents of selected requirements.
  */
export let getSelectedObjectsHtml = function() {
    return innerHTMLs;
};


/**
  * generate Compare HTML report.
  * @param {String} htmlData - String of the comparison of the two requirements
  * @param {Object} data - DeclViewModel
  */
export let showHtmlCompareReport = function( htmlData, data ) {
    var deferred = AwPromiseService.instance.defer();

    var divs = document.getElementsByClassName( 'aw-richtexteditor-documentPaper' );
    if ( divs && divs.length > 0 ) {
        // Wrapping contents in divs to look it like a Documentation tab
        var histMsg = showHistoryLabel( fileNames[0], fileNames[1], data );
        var requirementDiv = document.createElement( 'div' );
        deferred.resolve( {
            Arm0RequirementHistoryContextCompareToMsg:histMsg
        } );

        //Adding CSS
        requirementDiv.innerHTML = reqUtils.addCssInContents( htmlData );
        requirementDiv.innerHTML = requirementDiv.innerHTML.replace( /<span[^>]+?\/>/g, '' );
        divs[0].innerHTML = requirementDiv.outerHTML;
        return deferred.promise;
    }
};

var showHistoryLabel = function( Obj1, Obj2, data ) {
    var msg = data.i18n.comparingTo.replace( '{0}', Obj1 );
    msg = msg.replace( '{1}', Obj2 );
    var histMsg = _.clone( data.Arm0RequirementHistoryContextCompareToMsg );
    histMsg = msg;
    return histMsg;
};

/**
  * Construct the loading text.
  * @param {String} loadingText - i18n message to be displayed till comparison is being done.
  * @param {Array} selectedObjects - objects selected
  */
export let constructLoadingText = function( loadingText, selectedObjects, data ) {
    var deferred = AwPromiseService.instance.defer();

    var fileName1 = '';
    var fileName2 = '';

    if ( selectedObjects[0].cellHeader1 && selectedObjects[1].cellHeader1 ) {
        fileName1 = selectedObjects[0].cellHeader1;
        fileName2 = selectedObjects[1].cellHeader1;
    } else {
        fileName1 = selectedObjects[0].props.object_string.dbValues[0];
        fileName2 = selectedObjects[1].props.object_string.dbValues[0];
    }

    var loadMsg = loadingText.replace( '{0}', fileName1 );
    loadMsg = loadMsg.replace( '{1}', fileName2 );
    var loadingMsg = _.clone( data.Arm0RequirementCompareTextLoadMessage );
    loadingMsg = loadMsg;
    appCtxSvc.unRegisterCtx( 'Arm0CrossCompare' );

    deferred.resolve( {
        Arm0RequirementCompareTextLoadMessage:loadingMsg
    } );
    // Check type of the objects selected.
    if ( verifyObjectBelonging( requirementTypesArray, selectedObjects[0] ) && verifyObjectBelonging( requirementTypesArray, selectedObjects[1] ) ) {
        eventBus.publish( 'Arm0MultiSelectCompareText.requirementsComparison' );
    } else if ( reqSpecTypesArray.some( value => selectedObjects[0].modelType.typeHierarchyArray.includes( value ) )
     && reqSpecTypesArray.some( value => selectedObjects[1].modelType.typeHierarchyArray.includes( value ) ) ) {
        eventBus.publish( 'Arm0MultiSelectCompareText.getReqSpecifications' );
    } else {
        // One is Requirement and other is Req Specification
        appCtxSvc.registerCtx( 'Arm0CrossCompare', 'true' );
        if ( verifyObjectBelonging( requirementTypesArray, selectedObjects[0] ) ) {
            eventBus.publish( 'Arm0MultiSelectCompareText.requirementsComparison' );
            eventBus.publish( 'Arm0MultiSelectCompareText.getReqSpecifications' );
        } else {
            eventBus.publish( 'Arm0MultiSelectCompareText.getReqSpecifications' );
            eventBus.publish( 'Arm0MultiSelectCompareText.requirementsComparison' );
        }
    }

    return deferred.promise;
};

/**
  * check if object has one of the types from the type list.
  * @param {Array} typeList - types list
  * @param {Object} object - vmo or mo
  * @returns {Boolean} if it belongs
  */
var verifyObjectBelonging = function( typeList, object ) {
    return typeList.some( value => object.modelType.typeHierarchyArray.includes( value ) );
};

/**
  * Get the latest version of the selected Requirement Specification.
  * @param {Object} data - DeclViewModel.
  * @param {Array} selectedObjects - objects selected
  */
export let latestReqSpecifications = function( data, selectedObjectsInOrder ) {
    fileNames = [];
    for ( let i = 0; i < selectedObjectsInOrder.length; i++ ) {
        fileNames.push( constructFileName( selectedObjectsInOrder[i] ) );
    }
    var fulltext1Index;
    var fulltext1;
    var fulltext2Index;
    var fulltext2;
    var response = data.revReqSpecifications;
    if ( response.revToFullText ) {
        if ( response.revToFullText[0].length === 2 ) {
            if ( selectedObjectsInOrder[0].uid === response.objectPropValues[0][0].uid ) {
                fulltext1Index = response.revToFullText[1][0].length - 1;
                fulltext1 = response.revToFullText[1][0][fulltext1Index];
                fulltext2Index = response.revToFullText[1][1].length - 1;
                fulltext2 = response.revToFullText[1][1][fulltext2Index];
            } else {
                fulltext1Index = response.revToFullText[1][1].length - 1;
                fulltext1 = response.revToFullText[1][1][fulltext1Index];
                fulltext2Index = response.revToFullText[1][0].length - 1;
                fulltext2 = response.revToFullText[1][0][fulltext2Index];
            }
            var spec1 = {
                uid: fulltext1.uid,
                type: fulltext1.type,
                props: fulltext1.props
            };
            var spec2 = {
                uid: fulltext2.uid,
                type: fulltext2.type,
                props: fulltext2.props
            };
            eventBus.publish( 'Arm0MultiSelectCompareText.getReqSpecContentData', [ spec1, spec2 ] );
        } else if ( response.revToFullText[0].length === 1 ) {
            fulltext1Index = response.revToFullText[1][0].length - 1;
            fulltext1 = response.revToFullText[1][0][fulltext1Index];
            var spec1 = {
                uid: fulltext1.uid,
                type: fulltext1.type,
                props: fulltext1.props
            };
            eventBus.publish( 'Arm0MultiSelectCompareText.getReqSpecContentData', [ spec1, spec1 ] );
        }
    } else {
        // No fulltext recieved
        var loadingMsg = _.clone( data.Arm0RequirementCompareTextLoadMessage );
        loadingMsg = data.i18n.Arm0EmptyReqSpecCompareError;

        return{
            Arm0RequirementCompareTextLoadMessage:loadingMsg
        };
    }
};

/**
  * Get the Objects' uid and type .
  * @param {Array} selectedObjects - array of selected objects.
  * @return {Array} selectedObjects - objects selected
  */
export let getObjectWithTypes = function( selectedObjects ) {
    var objectIDandType = [];
    for ( let index = 0; index < selectedObjects.length; index++ ) {
        var type = getObjectType( selectedObjects[index], reqSpecTypesArray );
        if ( type ) {
            objectIDandType.push( { type: type, uid: selectedObjects[index].uid } );
        }
    }
    return objectIDandType;
};

/**
  * Check if the object's type belongs to the provided types list
  * @param {Object} obj - vmo or mo.
  * @param {Array} typeList - List of the types
  * @returns {String} matched type or undefined
  */
var getObjectType = function( obj, typeList ) {
    for ( var i = 0; i < typeList.length; i++ ) {
        if ( obj.modelType.typeHierarchyArray.indexOf( typeList[i] ) > -1 ) {
            return typeList[i];
        }
    }
};

/**
  * Returns the dummy input context object including fms base url in requestPref
  * @returns {Object} Input context object
  */
export let getDefaultInputContext = function() {
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
        requestPref: { base_url: exports.getFmsBaseURL() }
    };
};

/**
  * Set the innerHTML variable's value for the retured fulltexts
  * @param {Object} data - DeclViewModel.
  */
export let setInnerHTMLsForFullTexts = function( data ) {
    innerHTMLs = data.htmlContents;
    for ( let i = 0; i < innerHTMLs.length; i++ ) {
        formatInnerHTMLs( i );
    }
    eventBus.publish( 'Arm0MultiSelectCompareText.compareHtmlVersion' );
};

/**
  * Get Full FMS url.
  *
  */
export let getFmsBaseURL = function() {
    return browserUtils.getBaseURL() + fmsUtils.getFMSUrl();
};


/**
  * set innerHTML variable's value for cross comparison.
  * @param {Object} data - DeclViewModel.
  */
export let setInnerHTMLsForCrossCompare = function( data ) {
    for ( let i = 0; i < innerHTMLs.length; i++ ) {
        if( !innerHTMLs[i] || innerHTMLs[i] === '<div></div>' ) {
            innerHTMLs[i] = data.htmlContents[0];
        }
        formatInnerHTMLs( i );
    }
    if( innerHTMLs[0] === innerHTMLs[1] ) {
        var loadingMsg = _.clone( data.Arm0RequirementCompareTextLoadMessage );
        loadingMsg = data.i18n.Arm0EmptyReqSpecCompareError;

        return{
            Arm0RequirementCompareTextLoadMessage:loadingMsg
        };
    }
    eventBus.publish( 'Arm0MultiSelectCompareText.compareHtmlVersion' );
};

var formatInnerHTMLs = function( index ) {
    if ( innerHTMLs[index].indexOf( '<?xml' ) > -1 ) {
        innerHTMLs[index] = innerHTMLs[index].replace( /<\?xml/g, '<!--?xml' );
        innerHTMLs[index] = innerHTMLs[index].replace( /\?>/g, '?-->' );
    }
    if ( innerHTMLs[index].indexOf( '<span' ) > -1 ) {
        innerHTMLs[index] = innerHTMLs[index].replace( /<span[^>]+?\/>/g, '' );
    }

    var contentDivElement = document.createElement( 'div' );
    contentDivElement.innerHTML = innerHTMLs[index];
    var h3Element = contentDivElement.getElementsByTagName( 'h3' );
    for( let i = 0; i < h3Element.length; i++ ) {
        var spanElements = h3Element[i].getElementsByTagName( 'span' );
        if( spanElements.length > 1 ) {
            spanElements[1].remove();
        }
    }
    innerHTMLs[index] = contentDivElement.innerHTML;
};


/**
  * swap objects for comparison along file names
  */
export let objectSwap = function( ) {
    var temp = innerHTMLs[0];
    innerHTMLs[0] = innerHTMLs[1];
    innerHTMLs[1] = temp;
    temp = fileNames[0];
    fileNames[0] = fileNames[1];
    fileNames[1] = temp;
    eventBus.publish( 'Arm0MultiSelectCompareText.compareHtmlVersion' );
};


export default exports = {
    getRevisionObject,
    getExportOptions,
    postExportToApp3SOAResponse,
    getSelectedObjectsHtml,
    getCompareHtmlServiceURL,
    showHtmlCompareReport,
    constructLoadingText,
    latestReqSpecifications,
    getObjectWithTypes,
    getDefaultInputContext,
    setInnerHTMLsForFullTexts,
    getFmsBaseURL,
    setInnerHTMLsForCrossCompare,
    objectSwap
};
