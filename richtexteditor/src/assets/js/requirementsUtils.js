// Copyright (c) 2022 Siemens

/* global MathJax */

/**
 * @module js/requirementsUtils
 */
import { getBaseUrlPath } from 'app';
import commandsMapService from 'js/commandsMapService';
import iconService from 'js/iconService';
import tcVmoService from 'js/tcViewModelObjectService';
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import fileMgmtSvc from 'soa/fileManagementService';
import _ from 'lodash';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import { renderComponent } from 'js/declReactUtils';
import appCtxSvc from 'js/appCtxService';
import ckeditorOperations from 'js/ckeditorOperations';
var exports = {};

/** CKEditor image reference name prefix */
var CKE_IMG_REFNAME_PREFIX = 'tccke_ref_'; //$NON-NLS-1$

/** Map of dataset tyep against icon name */
var _oleObjectIconMapping = {
    MSWordX: 'MsWord',
    MSWord: 'MsWord',
    MSExcel: 'MsExcel',
    MSExcelX: 'MsExcel',
    MsPowerpoint: 'MsPowerpoint',
    MSPowerPointX: 'MsPowerpoint',
    PDF: 'Pdf',
    HTML: 'HtmlDataset',
    Zip: 'ZipFile',
    Default: 'Dataset',
    Text: 'Dataset',
    Image: 'Dataset',
    Fnd0Visio: 'Dataset'
};
var propertiesToLoad = [ 'awp0CellProperties', 'object_string' ];

/**
 * Return the type icon url for given type
 *
 * @param {String} typeName - type name
 * @param {String} typeHierarchy - type Hierarchy separated by comma
 */
export let getTypeIconURL = function( typeName, typeHierarchy ) {
    var typeIconString = iconService.getTypeIconURL( typeName );

    if( !typeIconString && typeHierarchy ) {
        var typeHierarchyArray = typeHierarchy.split( ',' );
        for( var ii = 0; ii < typeHierarchyArray.length && !typeIconString; ii++ ) {
            typeIconString = iconService.getTypeIconURL( typeHierarchyArray[ ii ] );
        }
    }

    if( !typeIconString ) {
        typeIconString = iconService.getTypeIconURL( 'Dataset' );
    }

    return browserUtils.getBaseURL() + typeIconString;
};

/**
 * Correct Image Tags.
 *
 * @param {String} bodyText- body text
 * @return {String} updated bodyText
 */
export let correctImageTags = function( bodyText ) {
    if( bodyText ) {
        bodyText = bodyText.replace( /<(\s*)img(.*?)\s*>/g, '<$1img$2/>' );
        bodyText = bodyText.replace( /<(\s*)img(.*?)\/\/\s*>/g, '<$1img$2></img>' );
        bodyText = bodyText.replace( /<(\s*)img(.*?)\/\s*>/g, '<$1img$2></img>' );
    }
    return bodyText;
};

/**
 * Replace self ended span tags with correct ending.
 *
 * @param {String} htmlString - html string
 * @return {String} updated html string
 */
export let correctSpanTags = function( htmlString ) {
    if( htmlString ) {
        htmlString = htmlString.replace( /<span([^\/>]+)\/>/g, '<span$1></span>' );
    }
    return htmlString;
};

/**
 * Function to remove empty spans from given html string
 * @param {String} html - html string
 * @return {String} updated html string
 */
export let removeEmptySpans = function( html ) {
    if( html ) {
        html = html.replace( /<span[^>]+?\/>/g, '' );
    }
    return html;
};

/**
 * Function to remove empty UI/OL from given html string
 * @param {String} html - html string
 * @return {String} updated html string
 */
export let removeSelfEndedUL = function( html ) {
    if( html ) {
        html = html.replace( /<ul\/>/g, '' );
        html = html.replace( /<ol\/>/g, '' );
    }
    return html;
};

/**
 * Removes unwanted characters from the html text
 *
 * @param {String} text- element text
 * @return {String} updated element text
 */
export let correctCharactersInText = function( text ) {
    if( text ) {
        // characters to strip from start and end of the input string
        text = text.replace( /^\||\|$/g, '' );
    }
    return text;
};

/**
 * Correct hr Tags.
 *
 * @param {String} bodyText- body text
 * @return {String} updated bodyText
 */
export let correctHrTags = function( bodyText ) {
    if( bodyText ) {
        bodyText = bodyText.replace( /<(\s*)hr(.*?)\/\s*>/g, '<$1hr$2></hr>' );
    }
    return bodyText;
};
/**
 * Encode Latin And Special Chars As HTML Entities.
 *
 * @param {String} bodyText- body text
 * @return {String} updated bodyText
 */
export let encodeLatinAndSpecialCharsAsHTMLEntities = function( bodyText ) {
    if( bodyText ) {
        bodyText = bodyText.replace( /[\u00A0-\u2666]/g, function( c ) {
            return '&#' + c.charCodeAt( 0 ) + ';';
        } );
    }
    return bodyText;
};

/**
 * Encode Private Unicode As HTMLEntities.
 *
 * @param {String} bodyText- body text
 * @return {String} updated bodyText
 */
export let encodePrivateUnicodeAsHTMLEntities = function( bodyText ) {
    if( bodyText ) {
        bodyText = bodyText.replace( /[\uE000-\uF8FF]/g, function( c ) {
            return '&#' + c.charCodeAt( 0 ) + ';';
        } );
    }
    return bodyText;
};

/**
 * Correct break Tags.
 *
 * @param {String} bodyText- body text
 * @return {String} updated bodyText
 */
export let correctBreakTags = function( bodyText ) {
    //break tag is a self closing tag and hence don't need to close explicitly
    if( bodyText ) {
        bodyText = bodyText.replace( /<br><\/br>/g, '<br/>' );
        bodyText = bodyText.replace( /<br>/g, '<br/>' );
    }
    return bodyText;
};

/**
 * Correct TD Tags.
 *
 * @param {String} bodyText- body text
 * @return {String} updated bodyText
 */
export let correctTDTags = function( bodyText ) {
    if( bodyText ) {
        bodyText = bodyText.replace( /<td> <\/td>/g, '<td><br/></td>' );
    }
    return bodyText;
};
/**
 * Correct COL Tags.
 *
 * @param {String} bodyText- body text
 * @return {String} updated bodyText
 */
export let correctColTags = function( bodyText ) {
    if( bodyText ) {
        bodyText = bodyText.replace( /<(\s*)col\s(.*?)\s*>/g, '<$1col $2/>' );
    }
    return bodyText;
};

/**
 * Correct Anchor Tags.
 *
 * @param {String} bodyText- body text
 * @return {String} updated bodyText
 */
export let correctAnchorTags = function( bodyText ) {
    if( bodyText ) {
        //Correct Self Ended Anchor Tags
        bodyText = bodyText.replace( /<(\s*)a(.*?)\/\s*>/g, '<$1a$2></a>' );
    }
    return bodyText;
};

/**
 * correct single code character.
 *
 * @param {String} bodyText- body text
 * @return {String} updated bodyText
 */
export let correctSingleCodeCharacter = function( bodyText ) {
    if( bodyText ) {
        bodyText = bodyText.replace( /\&#39;/g, '\'' );
    }
    return bodyText;
};
/**
 * Remove TOC settings icon.
 *
 * @param {String} bodyText- body text
 * @return {String} updated bodyText
 */
export let removeTOCSettingsIcon = function( bodyText ) {
    if( bodyText ) {
        bodyText = bodyText.replace( /<settingsIcon.*>.*?<\/settingsIcon>/ig, '<settingsIcon> </settingsIcon>' );
    }
    return bodyText;
};

/**
 * Get Image/OLE object from Fulltext named reference list.
 *
 * @param {String} id - Image/OLE id.
 * @return Object
 */

export let getFullTextRefObj = function( fullTextObject, ref_id ) {
    var refUIVal = null;
    if( fullTextObject && fullTextObject.props.ref_list ) {
        if( _.includes( ref_id, CKE_IMG_REFNAME_PREFIX ) ) {
            for( var i = 0; i < fullTextObject.props.ref_list.dbValues.length; i++ ) {
                refUIVal = fullTextObject.props.ref_list.uiValues[ i ];
                if( refUIVal === ref_id ) {
                    return fullTextObject.props.ref_list.dbValues[ i ];
                }
            }
        } else {
            for( var i = 0; i < fullTextObject.props.ref_list.dbValues.length; i++ ) {
                refUIVal = fullTextObject.props.ref_list.dbValues[ i ];
                if( _.includes( ref_id, refUIVal ) ) {
                    return fullTextObject.props.ref_list.dbValues[ i ];
                }
            }
        }
    }
    return null;
};

/**
 * get object of type from collection
 *
 * @param modelObjects collection of objects.
 * @param objType objType.
 * @return result object
 */
export let getObjectOfType = function( modelObjects, objType ) {
    if( modelObjects ) {
        var arrKey = Object.keys( modelObjects );

        for( var i = 0; i < arrKey.length; i++ ) {
            var key = arrKey[ i ];
            var modelObj = modelObjects[ key ];

            if( modelObj.type === objType ) {
                return modelObj;
            }
        }
    }
    return null;
};

/**
 * Process EditHandlerStateChanged Event
 *
 * @param {Object} data - The panel's view model object
 */
export let actionOleObjectClicked = function( data ) {
    var oleID = null;
    var oleObjectUID = null;
    data.oleObjsToDownload = null;
    data.oleObjectDS = null;

    if( data.eventData ) {
        oleID = data.eventData.oleid;
        oleObjectUID = data.eventData.oleObjectUID;
    }

    if( oleID && data.viewerProps.id === data.eventData.viewerid ) {
        var fullTextObject = data.fullTextObject;

        var imanID = exports.getFullTextRefObj( fullTextObject, oleID );

        if( imanID ) {
            data.oleObjsToDownload = [ {
                uid: imanID,
                type: 'ImanFile'
            } ];
        } else {
            data.oleObjectDS = [ {
                uid: oleObjectUID,
                type: 'unknownType'
            } ];
        }
    }
};
/**
 * Process HTML and correct tags.
 *
 * @param {String} bodyText - body text
 * @return {String} updated bodyText
 */
export let processHTMLBodyText = function( bodyText ) {
    bodyText = exports.encodeLatinAndSpecialCharsAsHTMLEntities( bodyText );

    bodyText = exports.encodePrivateUnicodeAsHTMLEntities( bodyText );

    bodyText = exports.correctBreakTags( bodyText );

    bodyText = exports.correctHrTags( bodyText );

    bodyText = exports.correctImageTags( bodyText );

    bodyText = exports.correctTDTags( bodyText );

    bodyText = exports.correctColTags( bodyText );

    bodyText = exports.correctSingleCodeCharacter( bodyText );

    bodyText = exports.correctAnchorTags( bodyText );

    bodyText = exports.removeTOCSettingsIcon( bodyText );

    return bodyText;
};


/**
 * Process given HTML and add ending tags to load it in dom parser.
 *
 * @param {String} content - html string content
 * @return {String} updated html string
 */
export let correctEndingTagsInHtml = function( content ) {
    content = exports.correctBreakTags( content );

    content = exports.correctHrTags( content );

    content = exports.correctImageTags( content );

    content = exports.correctTDTags( content );

    content = exports.correctColTags( content );

    content = exports.correctSingleCodeCharacter( content );

    content = exports.correctAnchorTags( content );

    content = exports.removeTOCSettingsIcon( content );

    content = exports.removeSelfEndedUL( content );

    return content;
};

/**
 * Get file URL from ticket.
 *
 * @param {String} ticket - File ticket.
 * @return file URL
 */

export let getFileURLFromTicket = function( ticket ) {
    if( ticket ) {
        return browserUtils.getBaseURL() + 'fms/fmsdownload/' + fmsUtils.getFilenameFromTicket( ticket ) +
            '?ticket=' + ticket;
    }
    return null;
};

/**
 * Check if String ends with given suffix
 *
 * @param {String} str - input string
 * @param {String} suffix - suffix
 * @return {boolean} true, if string ends with given suffix
 */
export let stringEndsWith = function( str, suffix ) {
    return str.indexOf( suffix, str.length - suffix.length ) !== -1;
};

/**
 * Load the mathjax library, if not loaded already and run script to find equations on the page and load the
 * required fonts.
 */
export let loadEquationFonts = function( contentEle ) {
    if( contentEle ) {
        var mathJaxJSFilePath = getBaseUrlPath() + '/lib/mathJax/MathJax.js?config=TeX-AMS-MML_HTMLorMML';
        browserUtils.attachScriptToDocument( mathJaxJSFilePath, function() {
            MathJax.Hub.Queue( [ 'Typeset', MathJax.Hub, contentEle ] );
        } );
    }
};

export let loadEquationAsReactComponents = function( contentEle ) {
    if( contentEle && contentEle.getElementsByClassName( 'equation' ).length > 0 ) {
        import( '@swf/mathjax-react' )
            .then( ( mathjaxReact ) => {
                let MathComponent =  mathjaxReact.MathComponent;
                let equationElements = contentEle.getElementsByClassName( 'equation' );
                for ( let index = 0; index < equationElements.length; index++ ) {
                    let eqElement = equationElements[index];
                    let equation = eqElement.innerText;
                    equation = equation.trim();
                    // Remove delimiters (e.g. \( \) or \[ \])
                    const hasInlineDelimiters = equation.includes( '\\(' ) && equation.includes( '\\)' );
                    const hasDisplayDelimiters = equation.includes( '\\[' ) && equation.includes( '\\]' );
                    if ( hasInlineDelimiters || hasDisplayDelimiters ) {
                        equation = equation.substring( 2, equation.length - 2 ).trim();
                    }
                    // Render Equation in React DOM
                    renderComponent( <MathComponent tex={equation}/>, eqElement );
                }
            } );
    }
};

export let getTracelinkObject = function( elementUid, revisionUid ) {
    return {
        elementUid: elementUid,
        revisionUid: revisionUid
    };
};

/**
 * get Revision Object.
 *
 * @param {Object} uid - Awb0Element or revision object
 * @return {Object} Revision Object
 */
var _getRevisionObject = function( uid ) {
    var sourceOcc = cdm.getObject( uid );
    if( !sourceOcc ) {
        exports.loadModelObjects( [ sourceOcc ], propertiesToLoad );
    }
    if( sourceOcc && commandsMapService.isInstanceOf( 'Awb0Element', sourceOcc.modelType ) && sourceOcc.props && sourceOcc.props.awb0UnderlyingObject ) {
        return cdm.getObject( sourceOcc.props.awb0UnderlyingObject.dbValues[ 0 ] );
    }
    return sourceOcc;
};

export let readTracelinkInfo = function( tracelinkInfo ) {
    var result = {};
    var columnData = [];
    var mapProps = {};

    for( var i = 0; i < tracelinkInfo.tracelinkPropInfo.length; i++ ) {
        var key = tracelinkInfo.tracelinkPropInfo[ i ].name ? tracelinkInfo.tracelinkPropInfo[ i ].name : tracelinkInfo.tracelinkPropInfo[ i ].propName;
        var value = tracelinkInfo.tracelinkPropInfo[ i ].propValues[ 0 ];
        mapProps[ key ] = value;
    }
    columnData.push( tracelinkInfo.primaryObjectPropInfo[ 0 ].propValues[ 0 ] );
    columnData.push( tracelinkInfo.primaryObjectPropInfo[ 1 ].propValues[ 0 ] );
    columnData.push( tracelinkInfo.secObjectPropInfo[ 0 ].propValues[ 0 ] );
    columnData.push( tracelinkInfo.secObjectPropInfo[ 1 ].propValues[ 0 ] );
    columnData.push( mapProps.name );
    columnData.push( tracelinkInfo.tracelinkType );

    if( mapProps.defining_context_name ) {
        columnData.push( mapProps.defining_context_name );
    } else {
        columnData.push( '' );
    }
    if( mapProps.complying_context_name ) {
        columnData.push( mapProps.complying_context_name );
    } else {
        columnData.push( '' );
    }
    result.data = columnData;
    if( tracelinkInfo.tracelink ) {
        result.tracelinkUid = tracelinkInfo.tracelink.uid;
    }
    if( tracelinkInfo.secondary ) {
        var secondary = _getRevisionObject( tracelinkInfo.secondary.uid );
        if( secondary ) {
            result.relatedObjectUid = secondary.uid;
        } else {
            result.relatedObjectUid = tracelinkInfo.secondary.uid;
        }
    }
    if( tracelinkInfo.primary ) {
        var primary = _getRevisionObject( tracelinkInfo.primary.uid );
        if( primary ) {
            result.primaryObjectUid = primary.uid;
        } else {
            result.primaryObjectUid = tracelinkInfo.primary.uid;
        }
    }

    return result;
};
/**
 * Load model objects common properties require to show on tracelink panel
 * @param {Array} objsToLoad - Model object list
 * returns the model objects from the given input
 */

export let loadModelObjects = function( objsToLoad, cellProp ) {
    var deferred = AwPromiseService.instance.defer();
    tcVmoService.getViewModelProperties( objsToLoad, cellProp ).then( function( response ) {
        deferred.resolve( response );
    } );
    return deferred.promise;
};
export let getTraceabilityMatrixFMSTicket = function( traceabilityObject ) {
    var imanFile = null;
    var deferred = AwPromiseService.instance.defer();

    var objectList = [ {
        uid: traceabilityObject.uid
    } ];
    var propNames = [ 'awp0AttachedMatrix' ];
    tcVmoService.getViewModelProperties( objectList, propNames ).then( function() {
        var datasetObj = cdm.getObject( traceabilityObject.props.awp0AttachedMatrix.dbValues[ 0 ] );
        objectList = [ {
            uid: datasetObj.uid
        } ];
        //get Named reference File
        tcVmoService.getViewModelProperties( objectList, [ 'ref_list' ] ).then( function() {
            if( datasetObj.props.ref_list && datasetObj.props.ref_list.dbValues.length > 0 ) {
                imanFile = datasetObj.props.ref_list.dbValues[ 0 ];
                //Get iman file object from uid
                var imanFileModelObject = cdm.getObject( imanFile );
                //downloadTicket
                var files = [ imanFileModelObject ];
                var promise = fileMgmtSvc.getFileReadTickets( files );
                promise.then( function( readFileTicketsResponse ) {
                    var originalFileName = null;
                    if( readFileTicketsResponse && readFileTicketsResponse.tickets && readFileTicketsResponse.tickets.length > 1 ) {
                        var imanFileArray = readFileTicketsResponse.tickets[ 0 ];
                        if( imanFileArray && imanFileArray.length > 0 ) {
                            var imanFileObj = cdm.getObject( imanFileArray[ 0 ].uid );
                            if( imanFileObj.props ) {
                                originalFileName = imanFileObj.props.original_file_name.uiValues[ 0 ];
                                originalFileName.replace( ' ', '_' );
                            }
                        }
                        var ticketsArray = readFileTicketsResponse.tickets[ 1 ]; //1st element is array of iman file while 2nd element is array of tickets
                        if( ticketsArray && ticketsArray.length > 0 ) {
                            deferred.resolve( ticketsArray[ 0 ] );
                            // _loadTraceabilityMatrix(data,ctx,ticketsArray[0]);
                        }
                    }
                } );
            }
        } );
    } );
    return deferred.promise;
};

/**
 * Insert type icon to ole objects imported from reqIF
 *
 * * @param innerHtml innerHtml
 */
export let insertTypeIconToOleObjects = function( innerHtml ) {
    var imgs = innerHtml.getElementsByTagName( 'img' );
    for( var ii = 0; ii < imgs.length; ii++ ) {
        var oleElement = imgs[ ii ];
        var thumbnailURL = null;
        var idOleElement = oleElement.getAttribute( 'oleid' );
        if( idOleElement ) {
            var olePreviewId = oleElement.getAttribute( 'olepreviewid' );
            //Skip src replacement in case of ole preview, src is getting replaced with ticket on server
            if( !olePreviewId || olePreviewId === '' ) {
                if( oleElement.getAttribute( 'datasetType' ) ) {
                    thumbnailURL = exports.getTypeIconURL(  oleElement.getAttribute( 'datasetType' ) );
                } else {
                    var imageURL = oleElement.getAttribute( 'src' );
                    if( !imageURL.includes( browserUtils.getBaseURL() ) ) {
                        thumbnailURL = exports.getTypeIconURL( _oleObjectIconMapping[ imageURL ] );
                    } else {
                        thumbnailURL = imageURL;
                    }
                }
                oleElement.setAttribute( 'src', thumbnailURL );
                if( !oleElement.hasAttribute( 'style' ) ||  oleElement.hasAttribute( 'style' ) && ( !oleElement.getAttribute( 'style' ).includes( 'height' ) || !oleElement.getAttribute( 'style' ).includes( 'width' ) )  ) {
                    oleElement.setAttribute( 'style', 'width:48px;height:48px;cursor:pointer;' );
                }
            } else {
                if( !oleElement.hasAttribute( 'width' ) || !oleElement.hasAttribute( 'height' )  ) {
                    oleElement.setAttribute( 'style', 'width:48px;height:48px;cursor:pointer;' );
                }
            }
        }
    }
};

/**
 * Generate unique Id for Ck Editor
 *
 * @return {String} random id
 */
export let generateCkeditorID = function() {
    // Math.random should be unique because of its seeding algorithm.
    // Convert it to base 36 (numbers + letters), and grab the first 9 characters
    // after the decimal.
    return 'ckeditor-instance-' + Math.random().toString( 36 ).substr( 2, 9 );
};

/**
 * Remove Ckeditor specific classes from given dom element
 * @param {Object} element - dom element
 */
export let removeCkeditorSpecificClasses = function( element ) {
    if( element && element.className ) {
        const prefix = 'ck-editor';
        const classes = element.className.split( ' ' ).filter( c => !c.startsWith( prefix ) );
        element.className = classes.join( ' ' ).trim();
    }
};

//CKEditor5 does not recognize Type attribute. Hence we are removing the Type attribute and adding Style Attribute in <ol>.
export let prepareAndUpdateListStyleType = function( elementChild ) {
    const tagName = elementChild.getElementsByTagName( 'ol' );
    for ( let i = 0; i < tagName.length; i++ ) {
        if( tagName[i] && tagName[i].attributes && tagName[i].attributes.type && tagName[i].attributes.type.value ) {
            let value = tagName[i].attributes.type.value;
            if( value === 'A' ) {
                tagName[i].removeAttribute( 'type' );
                tagName[i].attributes.style.value = 'list-style-type:upper-latin';
            } else if( value === 'a' ) {
                tagName[i].removeAttribute( 'type' );
                tagName[i].attributes.style.value = 'list-style-type:lower-latin';
            } else if( value === 'i' ) {
                tagName[i].removeAttribute( 'type' );
                tagName[i].attributes.style.value = 'list-style-type:lower-roman';
            } else if( value === 'I' ) {
                tagName[i].removeAttribute( 'type' );
                tagName[i].attributes.style.value = 'list-style-type:upper-roman';
            }
        }
    }
};


/**
 * Replacing all track change related html tags into ckeditor specific suggestion tags
 * @param {String} htmlContents htmlContents
 * @returns {String} updated htmlContents
 */
export let convertToSuggestionTags = function( htmlContents, isCKCollaborationSetupDone ) {
    const replaceSuggestionString = '<suggestion-start name=$1></suggestion-start>$3<suggestion-end name=$1></suggestion-end>';

    const regexStart1 = /<*ins id+\s*=\s*("([^"]*)")*\s*>(.*?)<\/ins>/g;
    htmlContents = findSavedSuggetionAutherID( regexStart1, htmlContents, isCKCollaborationSetupDone );
    htmlContents = htmlContents.replace( regexStart1, replaceSuggestionString );

    const regexStart2 = /<*del id+\s*=\s*("([^"]*)")*\s*>(.*?)<\/del>/g;
    htmlContents = findSavedSuggetionAutherID( regexStart2, htmlContents, isCKCollaborationSetupDone );
    htmlContents = htmlContents.replace( regexStart2, replaceSuggestionString );

    // for formatInline suggestion tag there can be multiple tags for single string
    // so handling it in loop to make sure to replace all html tags to ckeditor tags
    const regexStart3 = /<*span id+\s*=\s*("formatInline([^"]*)")*\s*>(.*?)<\/span>/g;
    htmlContents = findSavedSuggetionAutherID( regexStart3, htmlContents, isCKCollaborationSetupDone );
    let match = htmlContents.match( regexStart3 );
    while( match ) {
        htmlContents = htmlContents.replace( regexStart3, replaceSuggestionString );
        match = htmlContents.match( regexStart3 );
    }

    // replacing <br/> tag back with </p><p> tag to render new line change in ckeditor properly
    if( htmlContents.match( /<\/suggestion-start><br\/>/g ) ) {
        htmlContents = htmlContents.replace( /<\/suggestion-start><br\/>/g, '</suggestion-start></p><p>' );
    }

    return htmlContents;
};

//**To replace the authorId in saved suggetion data */
function findSavedSuggetionAutherID( regexStart1, htmlContents, isCKCollaborationSetupDone ) {
    if( isCKCollaborationSetupDone ) {
        var session = appCtxSvc.getCtx( 'userSession' );
        const usersLogin = session.props.user_id.dbValue;
        var editorId = appCtxSvc.getCtx( 'AWRequirementsEditor' ).id;
        var  editor = ckeditorOperations.getCKEditorInstance( editorId, appCtxSvc.ctx );
        var authorId;
        var match1 = htmlContents.match( regexStart1 );
        if( match1 && match1.length > 0 ) {
            for ( let i = 0; i < match1.length; i++ ) {
                var match2 = match1[i].split( '"' );
                var match3 = match2[1].split( ':' );
                var replaceString;
                var finalReplace;
                if( match3.length > 3 ) {
                    authorId = match3[3];
                    replaceString = match3[0] + ':' + match3[1] + ':' + match3[2] + ':' + match3[3];
                    finalReplace =  match3[0] + ':' + match3[1] + ':' + match3[2] + ':' + usersLogin;
                }else{
                    authorId = match3[2];
                    replaceString = match3[0] + ':' + match3[1] + ':' + match3[2];
                    finalReplace =  match3[0] + ':' + match3[1] + ':' + usersLogin;
                }

                htmlContents = htmlContents.replaceAll( replaceString, finalReplace );
            }
        }
    }

    return htmlContents;
}
/**
 * @param {String} content - html content
 * @return {String} processed html content
 */
export let addCssInContents = function( content ) {
    content = content.replace( /<span[^>]+?\/>/g, '' );
    var contentDivElement = document.createElement( 'div' );
    contentDivElement.innerHTML = content;

    var addedSpans = contentDivElement.getElementsByClassName( 'diff-html-added' );
    for ( let index = 0; index < addedSpans.length; index++ ) {
        let span = addedSpans[index];
        span.style.backgroundColor = '#EDFBF5';
        span.style.borderColor = '#84e3b9';
        span.style.borderStyle = 'solid';
        span.style.borderWidth = 'thin';
        let img = span.firstChild;
        if ( img && img.nodeName && img.nodeName.toUpperCase() === 'IMG' ) {
            img.style.borderColor = '#84e3b9';
        }
    }

    var removedSpans = contentDivElement.getElementsByClassName( 'diff-html-removed' );
    for ( let index = 0; index < removedSpans.length; index++ ) {
        let span = removedSpans[index];
        span.style.backgroundColor = '#FBEEED';
        span.style.borderColor = '#E38984';
        span.style.borderStyle = 'dashed';
        span.style.borderWidth = 'thin';
        let img = span.firstChild;
        if ( img && img.nodeName && img.nodeName.toUpperCase() === 'IMG' ) {
            img.style.borderColor = '#E38984';
        }
    }

    var changedSpans = contentDivElement.getElementsByClassName( 'diff-html-changed' );
    for ( let index = 0; index < changedSpans.length; index++ ) {
        let span = changedSpans[index];
        span.style.backgroundColor = '#E3FAFF';
        span.style.borderColor = '#66C8DE';
        span.style.borderStyle = 'solid';
        span.style.borderWidth = 'thin';
        let img = span.firstChild;
        if ( img && img.nodeName && img.nodeName.toUpperCase() === 'IMG' ) {
            img.style.borderColor = '#66C8DE';
        }
    }

    return contentDivElement.innerHTML;
};

/**
 * Service for RequirementACEUils.
 *
 * @member requirementsUtils
 */

export default exports = {
    getTypeIconURL,
    correctImageTags,
    correctSpanTags,
    removeEmptySpans,
    removeSelfEndedUL,
    correctCharactersInText,
    correctHrTags,
    encodeLatinAndSpecialCharsAsHTMLEntities,
    encodePrivateUnicodeAsHTMLEntities,
    correctBreakTags,
    correctTDTags,
    correctAnchorTags,
    correctSingleCodeCharacter,
    correctColTags,
    removeTOCSettingsIcon,
    getFullTextRefObj,
    getObjectOfType,
    actionOleObjectClicked,
    processHTMLBodyText,
    correctEndingTagsInHtml,
    getFileURLFromTicket,
    stringEndsWith,
    loadEquationFonts,
    loadEquationAsReactComponents,
    getTracelinkObject,
    readTracelinkInfo,
    loadModelObjects,
    getTraceabilityMatrixFMSTicket,
    insertTypeIconToOleObjects,
    generateCkeditorID,
    removeCkeditorSpecificClasses,
    prepareAndUpdateListStyleType,
    convertToSuggestionTags,
    addCssInContents
};
