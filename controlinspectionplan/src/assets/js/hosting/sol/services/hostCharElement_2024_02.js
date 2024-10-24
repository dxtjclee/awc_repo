// Copyright (c) 2024 Siemens

/**
 * @module js/hosting/sol/services/hostCharElement_2024_02
 * @namespace hostCharElement_2024_02
 */
import appCtxSvc from 'js/appCtxService';
import acp0ControlPlanUtils from 'js/Acp0ControlPlanUtils';
import hostBaseRefSvc from 'js/hosting/hostBaseRefService';
import hostBaseSelSvc from 'js/hosting/hostBaseSelService';
import _ from 'lodash';

/**
 * Selection type handler for PMIs selections.
 *
 * @constructor
 * @memberof hostCharElement_2024_02
 * @extends  hostBaseSelService.ISelectionTypeHandler
 */
var CharElementSelectionTypeHandler = function () {
    hostBaseSelSvc.getBaseSelectionTypeHandler().call(this);
};

CharElementSelectionTypeHandler.prototype = hostBaseSelSvc.extendBaseSelectionTypeHandler();
/**
 * Selection type handler for PMIs selections.
 *
 * @constructor
 * @memberof hostCharElement_2024_02
 */
var CharElementSelectionParser = function () {
    hostBaseSelSvc.getBaseSelectionObjectParser().call(this);
};

CharElementSelectionParser.prototype = hostBaseSelSvc.extendBaseSelectionObjectParser();
/**
 * See prototype.
 *
 * @function parse
 * @memberof hostCharElement_2024_02.CharElementSelectionParser
 *
 * @param {String} object - see prototype.
 *
 * @returns {ParsedSelectionObject} A new instance populated from given input.
 */
CharElementSelectionParser.prototype.parse = function (object) {
    return hostBaseSelSvc.createParsedSelectionObject(object);
};

/**
 * Handle selection based on given object references.
 *
 * @function processObjects
 * @memberof hostCharElement_2024_02.CharElementSelectionTypeHandler
 *
 * @param {StringArray} objects - Array of JSON encoded object references.
 *
 * @param {ISelectionObjectParser} parser - API used to convert an object string into
 * {ParsedSelectionObject}
 *
 * @param {Number} selectionTime - Time the selection arrived from the host.
 */
CharElementSelectionTypeHandler.prototype.processObjects = function (objects, parser, selectionTime) { // eslint-disable-line no-unused-vars

    // Check if we are currently in a Control Plan ACE sublocation.
    // If not then do not process a PMI type selection.
    var occMgmtContext = appCtxSvc.getCtx('occmgmtContext');
    if (occMgmtContext && occMgmtContext.topElement && occMgmtContext.topElement.modelType.typeHierarchyArray.indexOf('Acp0ControlPlanElement') > -1) {

        // Take UID of selected PMI objects.
        var selectedPmiUIDs = [];
        _.forEach(objects, function (obj) {
            var selectedObject = parser.parse(obj);
            if (selectedObject) {
                var targetUid = selectedObject.getValue(hostBaseSelSvc.OBJ_ID);
                var targetType = selectedObject.getValue(hostBaseSelSvc.OBJ_TYPE);
                if (targetUid && 'PMI' === targetType) {
                    selectedPmiUIDs.push(targetUid);
                }
            }
        });

        // Notify listeners of the PMIs selection.
        acp0ControlPlanUtils.handlePmiSelectionChange(selectedPmiUIDs);
    }
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
 * @memberof hostCharElement_2024_02
 *
 * @return {CharElementSelectionTypeHandler} New instance.
 */
export let createCharElementSelectionTypeHandler = function () {
    return new CharElementSelectionTypeHandler();
};

/**
 * Create new middle-level service.
 *
 * @memberof hostCharElement_2024_02
 *
 * @returns {CharElementSelectionParser} New instance of the API object.
 */
export let createCharElementSelectionParser = function () {
    return new CharElementSelectionParser();
};

/**
 * Register any client-side (CS) services (or other resources) contributed by this module.
 *
 * @memberof hostCharElement_2024_02
 */
export let registerHostingModule = function () {
    appCtxSvc.ctx.aw_hosting_state.map_selection_type_to_handler[hostBaseRefSvc.CHAR_ELEMENT_TYPE] = exports.createCharElementSelectionTypeHandler();
    appCtxSvc.ctx.aw_hosting_state.map_selection_type_to_parser[hostBaseRefSvc.CHAR_ELEMENT_TYPE] = exports.createCharElementSelectionParser();
};

export default exports = {
    createCharElementSelectionTypeHandler,
    createCharElementSelectionParser,
    registerHostingModule
};
