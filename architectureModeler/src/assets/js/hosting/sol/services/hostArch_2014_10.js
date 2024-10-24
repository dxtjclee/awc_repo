// Copyright (c) 2022 Siemens

/**
 * @module js/hosting/sol/services/hostArch_2014_10
 * @namespace hostArch_2014_10
 */
import appCtxSvc from 'js/appCtxService';
import hostBaseRefSvc from 'js/hosting/hostBaseRefService';
import hostBaseSelSvc from 'js/hosting/hostBaseSelService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import eventBus from 'js/eventBus';

/**
 * Convenience constants.
 */
var ArchConstants = {
    /** Product */
    // PRODUCT: "product",
};

/**
 * Selection type handler for uid selections
 *
 * @constructor
 * @memberof hostArch_2014_10
 * @extends  hostBaseSelService.ISelectionTypeHandler
 */
var ArchSelectionTypeHandler = function() {
    hostBaseSelSvc.getBaseSelectionTypeHandler().call( this );
};

ArchSelectionTypeHandler.prototype = hostBaseSelSvc.extendBaseSelectionTypeHandler();
/**
 * Selection type handler for uid selections
 *
 * @constructor
 * @memberof hostArch_2014_10
 */
var ArchSelectionParser = function() {
    hostBaseSelSvc.getBaseSelectionObjectParser().call( this );
};

ArchSelectionParser.prototype = hostBaseSelSvc.extendBaseSelectionObjectParser();
/**
 * See prototype.
 *
 * @function parse
 * @memberof hostArch_2014_10.ArchSelectionParser
 *
 * @param {String} object - see prototype.
 *
 * @returns {ParsedSelectionObject} A new instance populated from given input.
 */
ArchSelectionParser.prototype.parse = function( object ) {
    return hostBaseSelSvc.createParsedSelectionObject( object );
};

/**
 * Handle selection based on given object references.
 *
 * @function processObjects
 * @memberof hostArch_2014_10.ArchSelectionTypeHandler
 *
 * @param {StringArray} objects - Array of JSON encoded object references.
 *
 * @param {ISelectionObjectParser} parser - API used to convert an object string into
 * {ParsedSelectionObject}
 *
 * @param {Number} selectionTime - Time the selection arrived from the host.
 */
ArchSelectionTypeHandler.prototype.processObjects = function( objects, parser, selectionTime ) { // eslint-disable-line no-unused-vars
    /**
     * Only process selections when the occurrence management location is open.
     */
    var occMgmtCtx = appCtxSvc.getCtx( 'occmgmtContext' );

    if( !occMgmtCtx || !appCtxSvc.ctx.graph ) {
        return;
    }

    var selectedUIDs = [];

    _.forEach( objects, function( obj ) {
        var selectedObject = parser.parse( obj );

        if( selectedObject ) {
            var targetUid = selectedObject.getValue( hostBaseSelSvc.OBJ_ID );

            /**
             * The OccSelection can either specify the UID of the occurrence or the copy stable id path and
             * product of the occurrence.
             */
            var modelObject;

            if( targetUid ) {
                // Check if object is in the client cache.
                modelObject = cdm.getObject( targetUid );

                if( modelObject ) {
                    selectedUIDs.push( targetUid );
                }
            }
        }
    } );

    var selectionList = [];
    var graphModel = appCtxSvc.ctx.graph.graphModel;
    var graphControl = graphModel.graphControl;
    var visibleNodes = graphControl.graph.getVisibleNodes();

    _.forEach( visibleNodes, function( nodeModel ) {
        var awbElement = nodeModel.modelObject;

        if( awbElement ) {
            var underlyingObjProp = awbElement.props.awb0UnderlyingObject;

            if( underlyingObjProp ) {
                var revUid = underlyingObjProp.dbValues[ 0 ];
                var selNode = _.includes( selectedUIDs, revUid );

                if( selNode ) {
                    selectionList.push( awbElement.uid );
                }
            }
        }
    } );

    eventBus.publish( 'hosting.changeSelection', {
        operation: 'replace',
        selected: selectionList
    } );
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// Public Functions
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

var exports = {};
/**
 * Create new ISelectionTypeHandler.
 *
 * @memberof hostArch_2014_10
 *
 * @return {ArchSelectionTypeHandler} New instance.
 */
export let createArchSelectionTypeHandler = function() {
    return new ArchSelectionTypeHandler();
};
/**
 * Create new middle-level service.
 *
 * @memberof hostArch_2014_10
 *
 * @returns {ArchSelectionParser} New instance of the API object.
 */
export let createArchSelectionParser = function() {
    return new ArchSelectionParser();
};

/**
 * Convenience constants.
 *
 * @memberof hostArch_2014_10
 */
export { ArchConstants as ArchConstants };

/**
 * Register any client-side (CS) services (or other resources) contributed by this module.
 *
 * @memberof hostArch_2014_10
 */
export let registerHostingModule = function() {
    appCtxSvc.ctx.aw_hosting_state.map_selection_type_to_handler[ hostBaseRefSvc.ARCHITECTURE_TYPE ] = exports.createArchSelectionTypeHandler();
    appCtxSvc.ctx.aw_hosting_state.map_selection_type_to_parser[ hostBaseRefSvc.ARCHITECTURE_TYPE ] = exports.createArchSelectionParser();
};

export default exports = {
    createArchSelectionTypeHandler,
    createArchSelectionParser,
    ArchConstants,
    registerHostingModule
};
