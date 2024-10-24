// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
document
 */

/**
 * This implements the conversion of graph svg string return by GC API to final SVG string
 * which will have the actual SVG string of the icons
 *
 *
 * @module js/Ase0ArchitectureDiagramSVGUtilService
 */
import AwPromiseService from 'js/awPromiseService';
import $ from 'jquery';
import _ from 'lodash';

var USE_XLINK_ATTRIBUTE_KEY = 'xmlns:xlink';
var USE_XLINK_ATTRIBUTE_VAL = 'http://www.w3.org/1999/xlink';
var USE_HREF_ATTRIBUTE_KEY = 'xlink:href';
var USE_HREF_ATTRIBUTE_VAL = '#';
var ATTR_ID = 'id';

var classList = [
    '.aw-base-small',
    '.aw-graph-noeditable-area',
    '.aw-widgets-cellListItemNode',
    '.aw-architectureModeler-nodeThumbnailTargetSvg',
    '.aw-relations-noneSeedNodeSvg',
    '.aw-relations-seedNodeSvg',
    '.aw-graph-labelBackground',
    '.aw-graph-container',
    '.aw-widgets-cellListCellItemType',
    '.aw-widgets-cellListItemNodeSelected',
    '.aw-architectureModeler-SVGNodeCommands',
    '.aw-graph-boundary',
    '.aw-graph-boundaryLabel',
    '.aw-relations-tile-node',
    '.hidden'
];

// <summary> Function that retrieves the current CSS that's used by a specific CSS property </summary>
// <param name="element" type="SVG DOM"> The SVG DOM element that the browser will retrieve the used CSS from </param>
// <param name="styleStr" type="String"> The string name of the CSS attribute </param>
// <return type="SVG DOM"> The CSS value of the given styleStr.</return>
var computeStyle = function( element, styleStr ) {
    return window.getComputedStyle( element ).getPropertyValue( styleStr );
};

var getAttribute = function( element, attribProp ) {
    return element.getAttribute( attribProp );
};

// <summary> Function that retrieves the current CSS that's used by a specific CSS property </summary>
// <param name="colorStr" type="String"> The color value that needs the rgb vs rgba parsing</param>
// <return type="object">
// The object with the following properties: rgbVal, opacity.
// If the opacity is NULL, then the given colorStr was already in the rgb(rrr,ggg,bbb) format.
// </return>
var parseColorAndOpacity = function( colorStr ) {
    var obj = { rgbVal: null, opacity: null }; //What is returned

    // Checking if it's an rgba value
    // Using indexOf for IE11 compatibility
    if( colorStr ) {
        if( colorStr.indexOf( 'rgba' ) !== -1 ) {
            var val = colorStr.replace( 'rgba(', '' ); //Removes the "rgba(" from the original "rgba( rrr, bbb, ggg, aaa)" string
            val = val.replace( ')', '' ); //Removes the ending parenthes
            var numberArr = val.split( ',' ); //Changes the color values into an array

            //Changes the individual color values into a number
            for( var i = 0; i < numberArr.length; i++ ) {
                numberArr[ i ] = Number( numberArr[ i ] );
            }

            // The opacity value:
            obj.opacity = numberArr[ 3 ];

            //Create the "rgb" string
            var rgbStr = [ numberArr[ 0 ], numberArr[ 1 ], numberArr[ 2 ] ];
            obj.rgbVal = 'rgb(' + rgbStr.toString() + ')';
        } else {
            //It's already in the the RGB format
            obj.rgbVal = colorStr;
        }
    }
    return obj;
};

/**
 * set color and opacity for rgba
 * @param{HTMLDOM} element html element
 * @param{string} colorOpacity, color and opacity(rgba)
 * @param{string} attribute  name of the style attribute
 */
var setStyle = function( element, colorOpacity, attribute ) {
    var colorAndOpacity = parseColorAndOpacity( colorOpacity );
    if( attribute === 'fill' ) {
        if( colorAndOpacity.opacity !== null ) {
            //Following could be an alternative if the inline style version above doesn't work:
            element.setAttribute( 'fill-opacity', colorAndOpacity.opacity );
        }
        if( colorAndOpacity.rgbVal === 'transparent' ) {
            element.removeAttribute( 'fill' );
        } else {
            element.setAttribute( 'fill', colorAndOpacity.rgbVal );
        }
    } else if( attribute === 'stroke' ) {
        if( colorAndOpacity.opacity !== null ) {
            //Following could be an alternative if the inline style version above doesn't work:
            element.setAttribute( 'stroke-opacity', colorAndOpacity.opacity );
        }
        if( colorAndOpacity.rgbVal === 'transparent' ) {
            element.removeAttribute( 'stroke' );
        } else {
            element.setAttribute( 'stroke', colorAndOpacity.rgbVal );
        }
    }
};

var updateStylefromElementList = function( elementList ) {
    var len = elementList.length;
    var i;
    var temp = null;
    //IE11 Compatibility. Using the HTMLCollection.item(i) API instead of HTMLCollection[i].
    for( i = len - 1; i >= 0; i-- ) {
        temp = elementList[ i ];
        var family = computeStyle( temp, 'font-family' );
        temp.style.fontFamily = family;

        var fillColor = getAttribute( temp, 'fill' );
        if( fillColor ) {
            setStyle( temp, fillColor, 'fill' );
        }

        var strokeColor = getAttribute( temp, 'stroke' );
        if( strokeColor ) {
            setStyle( temp, fillColor, 'stroke' );
        }
    }
};

// <summary> This method will add inline styles specific to the given HTMLCollection parameters </summary>
// <param name="text" type="HTMLCollection"> The HTMLCollection of SVG <text> elements </param>
// <param name="rect" type="HTMLCollection"> The HTML Collection of SVG <rect> elements </param>
// <param name="svgTag" type="HTMLCollection"> The HTML Collection of SVG <svg> elements </param>
var updateStyles = function( text, rect, svgTag, path ) {
    var len = text.length;
    var i;
    var temp;
    //IE11 Compatibility. Using the HTMLCollection.item(i) API instead of HTMLCollection[i].
    for( i = len - 1; i >= 0; i-- ) {
        temp = text.item( i );
        var family = computeStyle( temp, 'font-family' );
        temp.style.fontFamily = family;

        var fillColorText = computeStyle( temp, 'fill' );
        var colorAndOpacity = parseColorAndOpacity( fillColorText );
        if( colorAndOpacity.opacity !== null ) {
            //temp.style.fillOpacity = colorAndOpacity.opacity;
            temp.setAttribute( 'fill-opacity', colorAndOpacity.opacity );
        }
        temp.style.fill = colorAndOpacity.rgbVal;

        var fillColor = getAttribute( temp, 'fill' );
        if( fillColor ) {
            setStyle( temp, fillColor, 'fill' );
        }

        var strokeColor = getAttribute( temp, 'stroke' );
        if( strokeColor ) {
            setStyle( temp, fillColor, 'stroke' );
        }
    }

    temp = null;
    len = rect.length;
    for( i = len - 1; i >= 0; i-- ) {
        temp = rect.item( i );

        var fillColorR = computeStyle( temp, 'fill' );
        var colorAndOpacityR = parseColorAndOpacity( fillColorR );
        if( colorAndOpacityR.opacity !== null ) {
            temp.style.fillOpacity = colorAndOpacityR.opacity;
        }
        temp.style.fill = colorAndOpacityR.rgbVal;

        var fillColorRect = getAttribute( temp, 'fill' );
        if( fillColorRect ) {
            setStyle( temp, fillColorRect, 'fill' );
        }

        var strokeColorRect = getAttribute( temp, 'stroke' );
        if( strokeColorRect ) {
            setStyle( temp, strokeColorRect, 'stroke' );
        }
    }

    temp = null;
    len = svgTag.length;
    for( i = len - 1; i >= 0; i-- ) {
        temp = svgTag.item( i );
        var fillStyle = computeStyle( temp, 'fill' );
        temp.style.fill = fillStyle;

        var fillColorS = computeStyle( temp, 'fill' );
        var colorAndOpacityS = parseColorAndOpacity( fillColorS );
        if( colorAndOpacityS.opacity !== null ) {
            temp.style.fillOpacity = colorAndOpacityS.opacity;
        }
        temp.style.fill = colorAndOpacityS.rgbVal;

        var fillColorSVG = getAttribute( temp, 'fill' );
        if( fillColorSVG ) {
            setStyle( temp, fillColorSVG, 'fill' );
        }

        var strokeColorSVG = getAttribute( temp, 'stroke' );
        if( strokeColorSVG ) {
            setStyle( temp, strokeColorSVG, 'stroke' );
        }
    }

    temp = null;
    len = path.length;
    for( i = len - 1; i >= 0; i-- ) {
        temp = path.item( i );

        var fillColorP = computeStyle( temp, 'fill' );
        var colorAndOpacityP = parseColorAndOpacity( fillColorP );
        if( colorAndOpacityP.opacity !== null ) {
            temp.style.fillOpacity = colorAndOpacityP.opacity;
        }
        temp.style.fill = colorAndOpacityP.rgbVal;

        var fillColorPath = getAttribute( temp, 'fill' );
        if( fillColorPath ) {
            setStyle( temp, fillColorPath, 'fill' );
        }

        var strokeColorPath = getAttribute( temp, 'stroke' );
        if( strokeColorPath ) {
            setStyle( temp, strokeColorPath, 'stroke' );
        }
    }
};

/**
 * @param {string} xmlDoc SVG diagram string from GC
 * @returns {array} array of image elements
 */
export let getImagesIconElement = function( xmlDoc ) {
    var elements = xmlDoc.getElementsByTagName( 'image' );
    var imageElements = $.makeArray( elements );
    return _.countBy( imageElements, function( image ) {
        return image.attributes[ 'xlink:href' ].value;
    } );
};

/**
 *
 * @param {map} images path of the images
 * @returns {promise} promise with array of image data info
 */
export let getImageSvgContent = function( images ) {
    var imageNameVsImageInfo = [];
    var defer = AwPromiseService.instance.defer();
    var promises = [];

    if( images ) {
        _.map( images, function( value, key ) {
            promises.push( $.get( key, function( data ) {
                var svg = null;
                if( data && data.contentType === 'text/xml' ) {
                    svg = data.querySelectorAll( 'svg' );
                    if( svg.length > 0 ) {
                        svg = svg[ 0 ];
                    }
                }
                var iconName = getIconNameFromPath( key );
                var uniqId = _.uniqueId( 'icon_' );
                var imageInfo = {
                    iconName: iconName,
                    content: svg,
                    id: uniqId
                };
                imageNameVsImageInfo.push( imageInfo );
            }, 'xml' ) );
        } );
        AwPromiseService.instance.all( promises ).then( function() {
            defer.resolve( imageNameVsImageInfo );
        } );
    }
    return defer.promise;
};

/**
 *
 * @param {String} iconPathArr path of the icon
 * @returns {String} name of the icon
 */
var getIconNameFromPath = function( iconPathArr ) {
    var iconPath = _.split( iconPathArr, '/' );
    var iconName = '';
    if( iconPath.length > 2 ) {
        var splitIconName = _.split( iconPath[ 2 ], '.' );
        if( splitIconName.length > 0 ) {
            iconName = splitIconName[ 0 ];
        }
    }
    return iconName;
};

/**
 *
 * @param {Object} imagesInfo path of the icon
 * @returns {HTMLElement} icon svg content
 */
var getSvgIconContent = function( imagesInfo ) {
    var newGTag = document.createElement( 'g' );
    newGTag.setAttribute( ATTR_ID, imagesInfo.id );
    newGTag.append( imagesInfo.content );
    return newGTag;
};

/**
 * @param {object} imageInfo image information
 * @returns{HTMLElement} use tag
 */
var getCreateUseElementTag = function( imageInfo ) {
    var newUseTag = document.createElement( 'use' );
    newUseTag.setAttribute( USE_XLINK_ATTRIBUTE_KEY, USE_XLINK_ATTRIBUTE_VAL );
    newUseTag.setAttribute( USE_HREF_ATTRIBUTE_KEY, USE_HREF_ATTRIBUTE_VAL + imageInfo.id );
    return newUseTag;
};

/**
 *extracts required css for diagram preview from main.css
 *
 * @param {DOM} svgRoot html svg dom element for diagram
 */
var processCssStyle = function( svgRoot ) {
    var styleSheets = document.styleSheets;
    var sheetContent = '';

    _.forEach( styleSheets, function( sheet ) {
        if( sheet.href &&  sheet.href.indexOf( 'main.css' ) !== -1  ) {
            sheetContent = sheet;
        }
    } );

    var cssToEmebed = '';
    var remIndex; // This variable will hold the value of the regular expression used to determine the presence of "rem" as font-size unit.

    _.forEach( classList, function( cssClass ) {
        _.forEach( sheetContent.cssRules, function( item ) {
            if( item && item.selectorText && item.selectorText === cssClass ) {
                cssToEmebed += '\n';
                remIndex = item.cssText.search( /\drem;/ );
                if( remIndex > -1 ) {
                    // This block of code is executed when "rem" is font-size unit. "rem" is replaced with "em".
                    cssToEmebed += item.cssText.slice( 0, remIndex + 1 ) + item.cssText.slice( remIndex + 2, item.cssText.length );
                } else {
                    cssToEmebed += item.cssText;
                }
            }
        } );
    } );

    if( !_.isEmpty( cssToEmebed ) ) {
        var style = document.createElement( 'style' );
        style.appendChild( document.createTextNode( cssToEmebed ) );
        var rootHTMLDOM = svgRoot.querySelectorAll( '[data-sdf-id=\'SDF_svgRoot\']' ).item( 0 );
        rootHTMLDOM.appendChild( style );
    }
};

/**
 *adjust the view box based on the container node matrix transformation
 *
 * @param {DOM} svgRoot : svg root element
 * @param {DOM} boundaries boundaries in diagram
 */
export let processBoundaries = function( svgRoot, boundaries ) {
    var mainCanvas = svgRoot.querySelectorAll( '[data-sdf-id=\'SDF_mainCanvas\']' ).item( 0 );

    if( mainCanvas && boundaries && boundaries.length > 0 ) {
        _.forEach( boundaries, function( containerNode ) {
            var node = containerNode.getSVGDom().cloneNode( true );
            mainCanvas.insertBefore( node, mainCanvas.firstChild );
        } );

        var svgRootViewBox = svgRoot.viewBox.baseVal;
        var rootX = null;
        var rootY = null;
        var rootW = null;
        var rootH = null;

        //get the offset of the main canvas and adjust position for container diagram
        var clientBounding = mainCanvas.getBoundingClientRect();

        //for adjusting container node, we  need to reduce the value of X and Y of root viewbox.
        if(  svgRootViewBox.x < 0 && clientBounding.x < 0  ||  svgRootViewBox.x > 0 && clientBounding.x < 0  ) {
            rootX = svgRootViewBox.x +  clientBounding.x;
        } else {
            rootX = svgRootViewBox.x -  clientBounding.x;
        }

        if(  svgRootViewBox.y < 0 && clientBounding.y < 0  ||  svgRootViewBox.y > 0 && clientBounding.y < 0  ) {
            rootY = svgRootViewBox.y +  clientBounding.y;
        } else {
            rootY = svgRootViewBox.y -  clientBounding.y;
        }

        rootW = Math.abs( svgRootViewBox.width ) + Math.abs( clientBounding.x );
        rootH = Math.abs( svgRootViewBox.height ) + Math.abs( clientBounding.y );
        if( rootX && rootW ) {
            svgRoot.viewBox.baseVal.x = rootX;
            //since we are adjusting x we need to adjust the width
            svgRoot.viewBox.baseVal.width = rootW;
        }
        if( rootY && rootH ) {
            svgRoot.viewBox.baseVal.y = rootY;
            //since we are adjusting y we need to adjust the height
            svgRoot.viewBox.baseVal.height = rootH;
        }
    }
};

/**
 *
 * @param {DOM} svgRoot html document object
 * @param {array} imagesInfo contains information about the image content and its xlink:href id
 */
export let processStyleTags = function( svgRoot ) {
    svgRoot.style.fill = 'white';
    //Only dealing with SDF_SheetFeatures and SDF_MainCanvas
    var mainCanvas = svgRoot.querySelectorAll( '[data-sdf-id=\'SDF_mainCanvas\']' ).item( 0 );

    // Retrieving the SVG text, rect, and inner SVG elements.
    // What is returned from getElementsByTagName are HTMLCollections, not Arrays.
    var text = mainCanvas.getElementsByTagName( 'text' );
    var rect = mainCanvas.getElementsByTagName( 'rect' );
    var svgTag = mainCanvas.getElementsByTagName( 'svg' );
    var path = mainCanvas.getElementsByTagName( 'path' );
    updateStyles( text, rect, svgTag, path );

    var defs = svgRoot.getElementsByTagName( 'defs' );
    var defGTags = defs[ 0 ].getElementsByTagName( 'g' );
    updateStylefromElementList( defGTags );
};

//replace image tags with actual svg content
export let processUseTag = function( svgRoot, imagesInfo ) {
    processCssStyle( svgRoot );
    var defs = svgRoot.getElementsByTagName( 'defs' );
    var $imgs = svgRoot.getElementsByTagName( 'image' );
    _.forEach( imagesInfo, function( imageInfo ) {
        var useTag = getCreateUseElementTag( imageInfo );
        var iconContent = getSvgIconContent( imageInfo );
        defs[ 0 ].appendChild( iconContent );
        var i = $imgs.length - 1;
        while( i !== -1 ) {
            var imagePath = $imgs[ i ].getAttribute( 'xlink:href' );
            if( imagePath.includes( imageInfo.iconName ) ) {
                var parentEl = $imgs[ i ].parentElement;
                if( parentEl ) {
                    parentEl.innerHTML = useTag.outerHTML;
                }
            }
            --i;
        }
    } );
    return svgRoot.querySelectorAll( '[data-sdf-id=\'SDF_svgRoot\']' ).item( 0 ).outerHTML;
};

const exports = {
    getImagesIconElement,
    getImageSvgContent,
    processBoundaries,
    processStyleTags,
    processUseTag
};
export default exports;
