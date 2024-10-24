// Copyright 2021 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ase0ArchitectureGraphTemplateService
 */
import graphTemplateService from 'js/graphTemplateService';
import _ from 'lodash';
import logger from 'js/logger';
import graphStyleUtils from 'js/graphStyleUtils';
import awIconSvc from 'js/awIconService';

'use strict';

var THUMBNAIL_URL = 'thumbnail_image';
var TEMPLATE_ID_DELIMITER = '-';
var TEMPLATE_VALUE_CONN_CHAR = '\\:';

var NODE_TEMPLATE_NAME = 'Ase0ArchitectureNodeTemplate';

var GROUP_NODE_TEMPLATE_NAME = 'Ase0ArchitectureGroupNodeTemplate';

/**
 * Binding class name for node
 */
export let NODE_HOVERED_CLASS = 'relation_node_hovered_style_svg';

/**
 * Binding class name for text inside the tile
 */
export let TEXT_HOVERED_CLASS = 'relation_TEXT_hovered_style_svg';

/**
 * Binding Class Name for node opacity style
 */
var NODE_OPACITY_STYLE = 'nodeIndication_opacity_style';

/**
 * Binding hide node command title
 */
var HIDE_NODE_TOOLTIP = 'hideNode_tooltip';

/**
 * The interpolate delimiter used in node SVG template
 */
var _nodeTemplateInterpolate = {
    interpolate: /<%=([\s\S]+?)%>/g
};

/**
 * Get node template by populate the base template with given binding property names
 *
 * @param {Object} nodeTemplateCache Node Template Cache
 * @param {Array} propertyNames the names of node object property
 * @param {boolean} isGroup flag
 * @returns {Object} node template
 */
export let getNodeTemplate = function( nodeTemplateCache, propertyNames, isGroup ) {
    //template doesn't exist, construct it and put in template cache
    var baseTemplateId = null;

    baseTemplateId = isGroup ? GROUP_NODE_TEMPLATE_NAME : NODE_TEMPLATE_NAME;

    var baseTemplate = nodeTemplateCache[ baseTemplateId ];
    if( !baseTemplate ) {
        logger.error( 'SVG template has not been registered. Template ID: ' + baseTemplateId );
        return null;
    }

    var templateId = baseTemplateId;
    if( propertyNames && propertyNames.length > 0 ) {
        templateId += TEMPLATE_ID_DELIMITER;
        templateId += propertyNames.join( TEMPLATE_ID_DELIMITER );
    }

    var template = nodeTemplateCache[ templateId ];
    if( template ) {
        return template;
    }

    var newTemplate = _.cloneDeep( baseTemplate );
    newTemplate.templateId = templateId;
    newTemplate.templateContent = getTemplateContent( templateId, baseTemplate.templateContent, propertyNames );

    //cache the new template
    nodeTemplateCache[ templateId ] = newTemplate;
    return newTemplate;
};

/**
 * Get cell property names for the node object.
 *
 * @param {Object} nodeObject the node model object
 * @return {Array} the array of cell property names
 */
export let getBindPropertyNames = function( nodeObject ) {
    var properties = [];

    if( nodeObject.props.awp0CellProperties && nodeObject.props.awp0CellProperties.uiValues ) {
        _.forEach( nodeObject.props.awp0CellProperties.uiValues, function( prop ) {
            var nameValue = prop.split( TEMPLATE_VALUE_CONN_CHAR );
            properties.push( nameValue[ 0 ] );
        } );
        return properties;
    }
};

var setNodeThumbnailProperty = function( nodeObject, bindProperties, typeHierarchy ) {
    if( !awIconSvc ) {
        return;
    }

    var imageUrl = awIconSvc.getThumbnailFileUrl( nodeObject );

    //show type icon instead if thumbnail doesn't exist
    if( !imageUrl ) {
        if( typeHierarchy && typeHierarchy.length > 0 ) {
            imageUrl = awIconSvc.getTypeIconFileUrlForTypeHierarchy( typeHierarchy );
        } else {
            imageUrl = awIconSvc.getTypeIconFileUrl( nodeObject );
        }
    }

    bindProperties[ THUMBNAIL_URL ] = graphStyleUtils.getSVGImageTag( imageUrl );
};

/**
 * Get the binding properties for the given node object
 *
 * @param {Object} nodeObject the node model object
 * @param {Array} propertyNames the names of node object property to display
 * @param {Object} data data
 *  @param {Object} typeHierarchy typeHierarchy
 * @return {Object} the object including all the required binding properties for a node template
 */
export let getBindProperties = function( nodeObject, propertyNames, data, typeHierarchy ) {
    var properties = {};
    if( nodeObject.props.awp0CellProperties && nodeObject.props.awp0CellProperties.uiValues ) {
        for( var i = 0; i < nodeObject.props.awp0CellProperties.uiValues.length; ++i ) {
            var nameValue = nodeObject.props.awp0CellProperties.uiValues[ i ].split( TEMPLATE_VALUE_CONN_CHAR );
            properties[ nameValue[ 0 ] ] = i > 1 ? nameValue[ 0 ] + ': ' + nameValue[ 1 ] : nameValue[ 1 ];
            //First property from bind data is editable
            if( i === 0 ) {
                properties[ nameValue[ 0 ] + '_editable' ] = true;
                properties.Title = nameValue[ 0 ];
            }
        }
    }
    setHoverNodeProperty( properties, null );
    //get thumbnail for node
    setNodeThumbnailProperty( nodeObject, properties, typeHierarchy );

    if( data && data.nodeOpacityPropName && nodeObject.props[ data.nodeOpacityPropName ] && nodeObject.props[ data.nodeOpacityPropName ].dbValues &&
        nodeObject.props[ data.nodeOpacityPropName ].dbValues.length > 0 ) {
        var isOpaque =  nodeObject.props[ data.nodeOpacityPropName ].dbValues[ 0 ] === '0';
        setOpacityProperty( properties, isOpaque );
    }

    if( data && data.i18n ) {
        properties[ HIDE_NODE_TOOLTIP ] = data.i18n.hideNodeTooltip;
    }

    properties.children_full_loaded = true;
    return properties;
};

/**
 * Construct the node template from a base template with the bind properties. The first two properties will be
 * interpolate to title and sub_title. The remaining properties will bind to property list.
 *
 *
 * @param {String} templateId the template ID of the constructed template. If not given, the template ID will be the string
 *            of bind property Names joined by '-'.
 * @param {String} baseTemplateString the base template string with interpolate delimiter '<%= %>'.
 * @param {Array} propertyNames the array of bind property names
 * @return {Object} the generated template string with bind property names been interpolated.
 */
var getTemplateContent = function( templateId, baseTemplateString, propertyNames ) {
    var templateData = {};

    if( propertyNames instanceof Array ) {
        if( !templateId ) {
            templateId = propertyNames.join( '-' );
        }

        var len = propertyNames.length;
        if( len > 0 ) {
            // Add escape to special characters before parsing to HTML
            var titleProperty = _.escape( propertyNames[ 0 ] );
            templateData.title = titleProperty;
            templateData.title_editable = titleProperty + graphTemplateService.EDITABLE_PROPERTY_SURFIX;
        }

        if( len > 1 ) {
            var subtitleProperty = _.escape( propertyNames[ 1 ] );
            templateData.sub_title = subtitleProperty;
            templateData.sub_title_editable = subtitleProperty + graphTemplateService.EDITABLE_PROPERTY_SURFIX;
        }

        if( len > 2 ) {
            var properties = propertyNames.slice( 2 );
            var formattedProperties = [];
            _.forEach( properties, function( prop ) {
                formattedProperties.push( _.escape( prop ) );
            } );
            templateData.property_list = formattedProperties;
        }
    }

    if( templateId ) {
        templateData.template_id = templateId;
    }

    return constructNodeTemplate( baseTemplateString, templateData );
};

var constructNodeTemplate = function( baseTemplateString, templateData ) {
    if( !baseTemplateString ) {
        return '';
    }

    var bindData = {};
    if( templateData ) {
        bindData = _.clone( templateData );
    }

    if( !bindData.property_list ) {
        bindData.property_list = [];
    }
    var nodeTemplate = _.template( baseTemplateString, _nodeTemplateInterpolate );
    return nodeTemplate( bindData );
};

var setHoverNodeProperty = function( properties, hoveredClass ) {
    if( hoveredClass ) {
        properties[ exports.NODE_HOVERED_CLASS ] = hoveredClass;
        properties[ exports.TEXT_HOVERED_CLASS ] = hoveredClass;
    } else {
        properties[ exports.NODE_HOVERED_CLASS ] = 'aw-graph-noeditable-area';
        properties[ exports.TEXT_HOVERED_CLASS ] = '';
    }
};

var setOpacityProperty = function( properties, isOpaque ) {
    if( isOpaque ) {
        properties[ NODE_OPACITY_STYLE ] = 'aw-architectureModeler-NodeOpacity';
    } else {
        properties[ NODE_OPACITY_STYLE ] = 'aw-architectureModeler-defaultNodeOpacity';
    }
};

const exports = {
    NODE_HOVERED_CLASS,
    TEXT_HOVERED_CLASS,
    getNodeTemplate,
    getBindPropertyNames,
    getBindProperties
};
export default exports;
