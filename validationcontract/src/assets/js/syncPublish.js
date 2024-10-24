// Copyright (c) 2022 Siemens

/**
 * @module js/syncPublish
 */
var exports = {};

export let getSynchronizeMeasurableAttributesInput = function (operation, parametersTable, SelObj) {
    if (parametersTable && parametersTable.selectedObjects && parametersTable.selectedObjects.length && parametersTable.selectedObjects.length > 0) {
        var proxyMeasurableAttrs = parametersTable.selectedObjects;
    }
    if (parametersTable && parametersTable.parentObjects) {
        var scopeSelection = parametersTable.parentObjects[0];
    }
    if (operation === 'Sync') {
        return {
            input: [{
                clientId: 'SyncOrPublish',
                analysisRequest: scopeSelection,
                attrs: proxyMeasurableAttrs,
                action: 'syncAttr'
            }]
        };
    }
    else if (operation === 'PropagateFromSim') {
        var options = {
            action: 'propagate',
            propagateDirection: 'fromMappedParameter',
            publishParametersFromVr: 'true'
        };
        var inputs = {
            clientId: 'PublishParameter',
            parametersPublishInput: proxyMeasurableAttrs
        };
        return { propagateInput: [inputs], options: options };
    }
    else if (operation === 'PropagateToSim') {
        var options = {
            action: 'propagate',
            propagateDirection: 'toMappedParameter',
            publishParametersFromVr: 'true'
        };
        var inputs = {
            clientId: 'PublishParameter',
            parametersPublishInput: proxyMeasurableAttrs
        };
        return { propagateInput: [inputs], options: options };
    }
    if (SelObj) {
        var inputs = {
            clientId: 'PublishParameter',
            parametersPublishInput: proxyMeasurableAttrs
        };
        var publishToGoal;
        var publishRange;
        if (operation === 'PublishMVToMVWithGMM') {
            publishToGoal = 'false';
            publishRange = 'true';
        } else if (operation === 'PublishMVToMVWithoutGMM') {
            publishToGoal = 'false';
            publishRange = 'false';
        } else if (operation === 'PublishMVToGoalWithMinMax') {
            publishToGoal = 'true';
            publishRange = 'true';
        } else if (operation === 'PublishMVToGoalWithoutMinMax') {
            publishToGoal = 'true';
            publishRange = 'false';
        }
        var options = {
            action: 'publish',
            publishParametersFromVr: 'true',
            publishToGoal: publishToGoal,
            publishRange: publishRange
        };
        return { publishInput: [inputs], options: options };
    }
};
export default exports = {
    getSynchronizeMeasurableAttributesInput
};

