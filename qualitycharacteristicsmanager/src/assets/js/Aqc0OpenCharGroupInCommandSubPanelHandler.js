// Copyright (c) 2022 Siemens

/**
 * This is the command handler for "Open Characteristics Group" on Navigation cell command
 *
 * @module js/Aqc0OpenCharGroupInCommandSubPanelHandler
 */
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Set command context for "Open Characteristics Group" cell command
 *
 * @param {ViewModelObject} context - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} $scope - scope object in which isVisible and isEnabled flags needs to be set.
 */
export let setCommandContext = function( context, $scope ) {
    $scope.cellCommandVisiblilty = true;
};

/**
 * Execute the command.
 * @param{ ViewModelObject } vmo - view model object
 * @param{ scope } $scope object
 */
export let execute = function( vmo ) {
    var eventData = {
        commnadContextVMO: vmo,
        nextActiveView: 'Aqc0ShowSpecificationsList'
    };
    eventBus.publish( 'aqc0.updateSharedDataForPanelNavigation', eventData );
    eventBus.publish( 'aqc0.loadCharSpecList', eventData );
};

export default exports = {
    setCommandContext,
    execute
};
