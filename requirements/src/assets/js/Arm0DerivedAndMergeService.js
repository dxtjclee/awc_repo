// Copyright (c) 2022 Siemens

/**
 * Module for the Derived and Merge
 *
 * @module js/Arm0DerivedAndMergeService
 */
import AwPromiseService from 'js/awPromiseService';
import reqACEUtils from 'js/requirementsACEUtils';
import soaSvc from 'soa/kernel/soaService';
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import AwHttpService from 'js/awHttpService';
import rmTreeDataService from 'js/Arm0ImportPreviewJsonHandlerService';
import importPreviewService from 'js/ImportPreview';
import compareJsonService from 'js/Arm0CompareJsonStructureService';
import reqUtils from 'js/requirementsUtils';
import _ from 'lodash';


var exports = {};
var _compareJsonData;   // json data with origional and compared result
var previewContentLoadedEvent;
var jmName;
var jmProp;

/**
 * Relative path to the FMS proxy download service.
 */
var CLIENT_FMS_DOWNLOAD_PATH = 'fms/fmsdownload/?ticket=';

/**
 *
 * @param {Object} ctx - Context object
 */
export let loadDerivedAndMasterDataToMerge = function( ctx ) {
    var topObj = reqACEUtils.getTopSelectedObject( ctx );

    eventBus.publish( 'progress.start' );

    _getSpecificationJsonData( topObj ).then( function( specifications ) {
        var jsonDerived = specifications[0].specification[0];
        var jsonMaster = specifications[1].specification[0];

        var outputSpecList = specifications[2].rootTypes;
        var outputSpecElementList = specifications[2].specElementTypes;
        var specList = Object.assign( outputSpecList, outputSpecElementList );

        rmTreeDataService.setDisplayType( jsonDerived, specList );
        rmTreeDataService.updateDisplayTypes( jsonDerived, specList );

        rmTreeDataService.setDisplayType( jsonMaster, specList );
        rmTreeDataService.updateDisplayTypes( jsonMaster, specList );

        // Set default action to revise
        jsonDerived.action = 'Revise';
        jsonMaster.action = 'Revise';

        _compareJsonData  = compareJsonService.compareJsonStructure( jsonMaster, jsonDerived );
        appCtxSvc.registerCtx( 'deriveAndMergeClick', true );

        var div = document.createElement( 'div' );
        div.innerHTML = _compareJsonData.compareHtmlData;
        ctx.comparedHtmlData = div;
        rmTreeDataService.setJSONData( _compareJsonData.comparedData );
        importPreviewService.setSecondaryArea();
        eventBus.publish( 'Arm0Requirement.navigateToMergePreview' );
        eventBus.publish( 'progress.end' );

        if( previewContentLoadedEvent ) {
            eventBus.unsubscribe( previewContentLoadedEvent );
            previewContentLoadedEvent = null;
        }

        // Add master item in context to use while Merge/Revise
        appCtxSvc.registerCtx( 'masterItemUid', {
            uid: jsonMaster.uniqueId,
            type: jsonMaster.internalType
        } );

        jmName = jsonMaster.name;
        jmProp = jsonMaster.properties;
    } );
};

export let setHeaderTitle = function() {
    // Update Location header with master specification name
    if( !jmProp ) {
        return;
    }
    var objId = '';
    var objName = jmName;
    for( let index = 0; index < jmProp.length; index++ ) {
        const prop = jmProp[ index ];
        if( prop && prop.name === 'object_string' && prop.value && prop.value.split( '/' ).length > 0 ) {
            objId = prop.value.split( '/' )[ 0 ];
            break;
        }
    }
    if( objId !== '' ) {
        objName = objId + ' - ' + jmName;
    }

    var locationTitleCtx = appCtxSvc.getCtx( 'location.titles' );
    locationTitleCtx.headerTitle = locationTitleCtx.headerTitle.replace( '{0}', objName );
    appCtxSvc.updateCtx( 'location.titles', locationTitleCtx );
};

var _getSpecificationJsonData = function( object ) {
    var inputData = {
        input: {
            selectedObjects: [
                object
            ],
            inputCtxt: reqACEUtils.getInputContext(),
            options: [],
            isRunInBackground: false,
            mode: 'MERGE_MASTERSPECIFICATION'
        }
    };
    var inputData2 = {
        input: {
            rootTypeName: '',
            specElementTypeName: 'SpecElement',
            exclusionBOTypeNames: [],
            option: ''
        }
    };

    var deferred = AwPromiseService.instance.defer();
    var promise = soaSvc.post( 'Internal-AwReqMgmtSe-2019-12-SpecNavigation', 'exportSpecifications', inputData );
    promise.then( function( response ) {
        if( response && response.fileTickets && response.fileTickets.length === 2 ) {
            var promiseFMS1 = AwHttpService.instance.get( CLIENT_FMS_DOWNLOAD_PATH + response.fileTickets[0] );
            var deferredFMS1 = AwPromiseService.instance.defer();
            promiseFMS1.then( function( responseFMS1 ) {
                var promiseFMS2 = AwHttpService.instance.get( CLIENT_FMS_DOWNLOAD_PATH + response.fileTickets[1] );
                var deferredFMS2 = AwPromiseService.instance.defer();
                promiseFMS2.then( function( responseFMS2 ) {
                    var promise3 = soaSvc.post( 'Internal-ActiveWorkspaceReqMgmt-2017-06-ImportExport', 'getDisplayableTypes', inputData2 );
                    var deferred3 = AwPromiseService.instance.defer();
                    promise3.then( function( response3 ) {
                        if ( responseFMS1 && responseFMS2 && response3 ) {
                            var specifications = [ responseFMS1.data, responseFMS2.data, response3 ];
                            deferred.resolve( specifications );
                        }
                    } ).catch( function( error ) {
                        deferred3.reject( error );
                        eventBus.publish( 'progress.end' );
                    } );
                } ).catch( function( error ) {
                    deferredFMS2.reject( error );
                    eventBus.publish( 'progress.end' );
                } );
            } ).catch( function( error ) {
                deferredFMS1.reject( error );
                eventBus.publish( 'progress.end' );
            } );
        } else {
            eventBus.publish( 'progress.end' );
        }
    } )
        .catch( function( error ) {
            deferred.reject( error );
            eventBus.publish( 'progress.end' );
        } );

    return deferred.promise;
};

export let getJSONDataForMerge = function( data ) {
    var deferred = AwPromiseService.instance.defer();

    data.mergeApplicationFormat = 'UpdateImportWithoutRevise';
    data.treeData = _getJSONData( data );

    var treeData = data.treeData;
    var mergeApplicationFormat = data.mergeApplicationFormat;
    deferred.resolve( {
        treeData:treeData,
        mergeApplicationFormat:mergeApplicationFormat
    } );
    return deferred.promise;
};

export let getJSONDataForRevise = function( data ) {
    var deferred = AwPromiseService.instance.defer();

    data.mergeApplicationFormat = 'UpdateImport';
    data.treeData = _getJSONData( data );

    var treeData = data.treeData;
    var mergeApplicationFormat = data.mergeApplicationFormat;
    deferred.resolve( {
        treeData:treeData,
        mergeApplicationFormat:mergeApplicationFormat
    } );
    return deferred.promise;
};

var _getJSONData = function( data ) {
    var treeData = _.clone( data.treeData );
    treeData = rmTreeDataService.getJSONData();
    // Preprocess Json - Avoid adding Object from master structure again
    filterAddObjects( treeData );
    preprocessObjects( treeData );
    eventBus.publish( 'importPreview.getFMSFileTicketForMerge' );
    return treeData;
};

/**
 * Update File Content In FormData For Import PDF
 *
 * @param {Object} data - View model object data
 */
export let updateFileContentInFormDataForMerge = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    data.formDataForMerge = new FormData();
    data.formDataForMerge.append( 'fmsFile', new Blob( [ JSON.stringify( data.treeData ) ], { type: 'text/plain' } ) );
    data.formDataForMerge.append( 'fmsTicket', data.jsonFmsTicketForMerge.trim() );

    var formDataForMerge = data.formDataForMerge;
    eventBus.publish( 'importSpecification.uploadImportFileForMerge' );

    deferred.resolve( {
        formDataForMerge:formDataForMerge
    } );
    return deferred.promise;
};

export let setJSONDataForMerge = function( data, jsonFmsTicket ) {
    var deferred = AwPromiseService.instance.defer();

    data.jsonFmsTicket = jsonFmsTicket.trim();

    var fmsTicket = data.jsonFmsTicket;
    eventBus.publish( 'importSpecification.mergeUsingJSONData' );

    deferred.resolve( {
        jsonFmsTicket:fmsTicket
    } );
    return deferred.promise;
};

export let unRegisterMergeContextData = function() {
    appCtxSvc.unRegisterCtx( 'deriveAndMergeClick' );
    appCtxSvc.unRegisterCtx( 'masterItemUid' );
    appCtxSvc.unRegisterCtx( 'rmselectedTargetElement' );
    appCtxSvc.unRegisterCtx( 'selectedTargetElement' );
    rmTreeDataService.setJSONData();    // Unset data on merge
};

/**
 * If Object already added in master, avoid adding it again. Change action while final action
 * @param {Object} jsonObject - json object
 */
var filterAddObjects = function( jsonObject ) {
    if( jsonObject.objectAlreadyAvailable ) {
        jsonObject.action = 'NoChange';
        jsonObject.status = 'NoChange';
    }
    var childs = jsonObject.children;
    for( var i = 0; i < childs.length; i++ ) {
        var node = childs[i];
        filterAddObjects( node );
    }
};

/**
 *
 * @param {JSON} jsonObject the json object to merge
 */
function preprocessObjects( jsonObject ) {
    var contents = jsonObject.contents;

    var mergedElement = document.getElementById( jsonObject.uniqueId );
    var propElement = mergedElement.getElementsByClassName( 'aw-requirement-previewPropertyTable' );
    jsonObject.propertyNameValues = []; // set empty array to skip prop update at server

    if( jsonObject.action === 'Update' ||  jsonObject.action === 'Revise' || jsonObject.action === 'Add' ) { // Get updated properties
        if( propElement.length > 0 ) {
            var propObject = getUpdatedProperties( propElement[0], jsonObject.action === 'Add' );
            if( propObject ) {
                jsonObject.propertyNameValues = propObject;
            }
            if( jsonObject.action === 'Add' ) {
                contents = jsonObject.contentsWithoutProp;
            }else if( !jsonObject.isPropertyUpdated ) {
                contents = jsonObject.updatedContentsWithoutProp;  // set updated content without properties data
            } else {                                               // if only prop updated
                contents = jsonObject.existingContentsWithoutProp;  // set existing content without properties data
                if( jsonObject.action === 'Update' ) {    // In case of revise, no need to change action, so do it only in case of update. Do not update action for top line
                    jsonObject.action = 'PropertyUpdate';     // Set action as PropertyUpdate to avoid conent update, if only props updated
                }
            }
        }
    }

    var htmlTagsCorrected = false;
    if( jsonObject.isMerged  && !jsonObject.isPropertyUpdated && !jsonObject.isSpecification ) {   // parse content if manually merged
        if( propElement.length === 0 ) {    // Merge without property compare table
            mergedElement = mergedElement.getElementsByClassName( 'aw-requirement-bodytext' )[0];
            mergedElement = mergedElement.firstElementChild;
        }else {
            mergedElement = mergedElement.getElementsByClassName( 'aw-requirement-previewContent' )[0];
        }
        removeDiffClasses( mergedElement );
        contents = mergedElement.innerHTML;
        contents = reqUtils.correctEndingTagsInHtml( contents );
        htmlTagsCorrected = true;
    }


    if( !htmlTagsCorrected && jsonObject && jsonObject.action !== 'NoChange' && contents !== '' ) {
        contents = reqUtils.correctImageTags( contents );
    }

    jsonObject.contents = contents;
    var childs = jsonObject.children;
    for( var i = 0; i < childs.length; i++ ) {
        var node = childs[i];
        preprocessObjects( node );
    }
}

/**
 *
 * @param {Element} elementoMerge the element to merge
 */
function updateEquation( elementoMerge ) {
    if( elementoMerge && elementoMerge.parentElement && elementoMerge.parentElement.classList.contains( 'equation' ) ) {
        elementoMerge.parentElement.innerText = elementoMerge.innerText;
    }
}

/**
 * Remove changetype attribute from given element if img
 * @param {Object} element - Dom element object
 */
function removeDiffAttrsFromImg( element ) {
    var imgNodes = element.getElementsByTagName( 'IMG' );
    imgNodes.forEach( img => {
        img.removeAttribute( 'changetype' );
    } );
}

/**
 *
 * @param {Element} elementoMerge the element to merge
 */
function removeDiffClasses( elementoMerge ) {
    var elementsList = elementoMerge.getElementsByClassName( 'diff-html-added' );
    for( var i = elementsList.length - 1; i >= 0; i-- ) {
        var element = elementsList[i];
        updateEquation( element );

        if( !element.classList.contains( 'aw-requirements-discardUpdate' ) ) {
            _updateHtmlDiffNode( element );
        } else {    // Update discarded - do not add added element
            var parentE = element.parentElement;
            parentE.removeChild( element );
            removeEmptyParagraph( parentE );
        }
    }

    elementsList = elementoMerge.getElementsByClassName( 'diff-html-removed' );
    for(  i = elementsList.length - 1; i >= 0; i-- ) {
        element = elementsList[i];
        if( !element.classList.contains( 'aw-requirements-discardUpdate' ) ) {
            var parentEl = element.parentElement;
            parentEl.removeChild( element );
            removeEmptyParagraph(  parentEl );
        } else {    // Update discarded
            _updateHtmlDiffNode( element );
        }
    }

    elementsList = elementoMerge.getElementsByClassName( 'diff-html-changed' );
    for(  i = elementsList.length - 1; i >= 0; i-- ) {
        element = elementsList[i];
        updateEquation( element );
        _updateHtmlDiffNode( element );
    }
}

/**
 * Remove element if it is empty span and parent paragraph if empty
 * @param {Object} element - dom element
 */
var removeEmptyParagraph = function( element ) {
    var parent = element.parentElement;
    if( element && element.nodeName === 'SPAN' && element.childNodes.length === 0 ) {     // If span is empty
        parent.removeChild( element ); // Remove empty span
        removeEmptyParagraph( parent );
    } else if( element && element.nodeName === 'P' && element.childNodes.length === 0 ) {     // If paragraph is empty
        parent.removeChild( element ); // Remove empty P
    }
};

var _updateHtmlDiffNode = function( element ) {
    if( element.childNodes.length === 1 && element.childNodes[0].nodeType === 3 ) {   // if element has single text child node
        element.parentElement.replaceChild( element.childNodes[0], element );
    } else if( element.childNodes.length === 1 && element.childNodes[0].nodeName === 'IMG' ) {   // if element has single image child node
        removeDiffAttrsFromImg( element );
        element.parentElement.replaceChild( element.firstElementChild, element );
    } else {
        while( element.attributes.length > 0 ) {
            element.removeAttribute( element.attributes[0].name );
        }
        removeDiffAttrsFromImg( element );
    }
};

var _isAnyDifferenceInCompare = function( content ) {
    if( content.indexOf( 'diff-html-added' ) > -1 || content.indexOf( 'diff-html-removed' ) > -1 || content.indexOf( 'diff-html-changed' ) > -1 )  {
        return true;
    }
    return false;
};

/**
 *
 * @param {Object} domElement -
 * @param {Boolean} skipDifferenceCheck - Skip html difference check while getting updated prps
 * @returns {Object} - Returns updated properties
 */
function getUpdatedProperties( domElement, skipDifferenceCheck ) {
    if( _isAnyDifferenceInCompare( domElement.innerHTML ) || skipDifferenceCheck ) {
        var propObj = [];
        var trs = domElement.getElementsByTagName( 'tr' );
        for( var i = 0; i < trs.length; i++ ) {
            var tr = trs[ i ];
            var prop = {};
            if( !tr.classList.contains( 'aw-splm-tableHeaderCell' ) && ( _isAnyDifferenceInCompare( tr.innerHTML ) || skipDifferenceCheck ) ) {
                var tds = tr.getElementsByTagName( 'td' );
                for( var j = 0; j < tds.length; j++ ) {
                    var td = tds[ j ];
                    if( td.firstElementChild.classList.contains( 'aw-splm-tableHeaderCellLabel' ) ) {
                        // property name
                        prop.propertyName = td.firstElementChild.getAttribute(
                            'property_internal_name'
                        );
                    } else {
                        // property value
                        var tdFirstChild = td.firstElementChild;
                        removeDiffClasses( tdFirstChild );
                        prop.propertyValue = tdFirstChild.innerText;
                    }
                }
                propObj.push( prop );
            }
        }
        if( propObj.length > 0 ) {
            return propObj;
        }
    }
}

export default exports = {
    loadDerivedAndMasterDataToMerge,
    getJSONDataForRevise,
    getJSONDataForMerge,
    updateFileContentInFormDataForMerge,
    setJSONDataForMerge,
    unRegisterMergeContextData,
    setHeaderTitle
};
