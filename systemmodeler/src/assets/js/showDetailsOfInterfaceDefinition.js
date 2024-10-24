// Copyright (c) 2022 Siemens

/**
 * This is the command handler for show object command which is contributed to cell list.
 *
 * @module js/showDetailsOfInterfaceDefinition
 */
import AwStateService from 'js/awStateService';
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import commandSvc from 'js/command.service';

var exports = {};

/**
 * Set command context for show object cell command which evaluates isVisible and isEnabled flags.
 *
 * @param {ViewModelObject} context - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} $scope - scope object in which isVisible and isEnabled flags needs to be set.
 */
export let setCommandContext = function( context, $scope ) {
    // Check for selection type is Seg0Implements
    if( cmm.isInstanceOf( 'Seg0Implements', context.modelType ) ) {
        $scope.cellCommandVisiblilty = true;
    } else {
        $scope.cellCommandVisiblilty = false;
    }
};

/**
 * Execute the command.
 * <P>
 * The command context should be setup before calling isVisible, isEnabled and execute.
 *
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} dataCtxNode - scope object in which isVisible and isEnabled flags needs to be set.
 * @param {Boolean} openInEditMode - Flag to indicate whether to open in edit mode.
 */
export let execute = function( vmo, dataCtxNode, openInEditMode ) {
    if( vmo && vmo.uid ) {
        //Mark the task as read

        if( !openInEditMode ) {
            var vmoModelObject = cdm.getObject( vmo.uid );
            var modelObject = vmoModelObject;
            if( vmoModelObject ) {
                modelObject = cdm.getObject( vmoModelObject.props.secondary_object.dbValues[ 0 ] );
            }

            var commandContext = {
                vmo: modelObject || vmo, // vmo needed for gwt commands
                edit: false
            };

            commandSvc.executeCommand( 'Awp0ShowObjectCell', null, null, commandContext );
        } else {
            var showObject = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
            var toParams = {};
            var options = {};

            toParams.uid = vmo.uid;
            if( openInEditMode ) {
                toParams.edit = 'true';
            }
            options.inherit = false;

            AwStateService.instance.go( showObject, toParams, options );
        }
    }
};

export default exports = {
    setCommandContext,
    execute
};
