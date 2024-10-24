// Copyright (c) 2022 Siemens

/**
 * @module js/Psi0AssignResourceService
 */
import commandPanelService from 'js/commandPanel.service';
import messagingService from 'js/messagingService';
import localeSvc from 'js/localeService';
import cdm from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import appCtxService from 'js/appCtxService';

var exports = {};

export let assignResourcePanel = function( commandId, location, ctx, data, commandContext ) {
    let selectedObjects = ctx.mselected;
    let message = '';
    if( commandContext.pageContext.primaryActiveTabId === 'tc_xrt_Deliverables' ||
        commandContext.pageContext.primaryActiveTabId === 'tc_xrt_Navigate' ||
        ( commandContext.pageContext.primaryActiveTabId === 'tc_xrt_Timeline' || commandContext.pageContext.primaryActiveTabId === 'tc_xrt_prgDeliverables' ) && ctx.selected.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
        let selectedOtherObjects = [];
        let selectedPrgDelRevisionObjects = [];
        let releasedPrgDelRevisionObjects = [];

        selectedObjects.forEach( function( selectedObject ) {
            if ( selectedObject.modelType.typeHierarchyArray.indexOf( 'Psi0PrgDelRevision' ) === -1 ) {
                selectedOtherObjects.push( selectedObject );
            } else {
                if ( selectedObject.props.release_status_list.dbValues.length !== 0 ) {
                    releasedPrgDelRevisionObjects.push( selectedObject );
                } else {
                    selectedPrgDelRevisionObjects.push( selectedObject );
                }
            }
        } );

        let simlilarObjLength = selectedPrgDelRevisionObjects.length;
        let otherObjLength = selectedOtherObjects.length;
        let releasedObjLength = releasedPrgDelRevisionObjects.length;

        if ( otherObjLength || releasedObjLength ) {
            let resource = 'PrgScheduleManagerMessages';
            let localTextBundle = localeSvc.getLoadedText( resource );
            let otherObjErrorMessage = '';
            let releaseStatusErrorMessage = '';
            let prgDelErrorMessage = '';
            let totalSelectedObj = selectedObjects.length;

            if ( totalSelectedObj > 1 ) {
                prgDelErrorMessage = localTextBundle.prgDelTypeObjectMessage;
                prgDelErrorMessage = messagingService.applyMessageParams( prgDelErrorMessage, [ '{{simlilarObjLength}}', '{{totalSelectedObj}}' ], {
                    simlilarObjLength: simlilarObjLength,
                    totalSelectedObj: totalSelectedObj
                } );
                message = prgDelErrorMessage;
            }

            if ( otherObjLength ) {
                // eslint-disable-next-line array-callback-return
                selectedOtherObjects.map( function( otherObject ) {
                    let otherTypeObjectMessage = localTextBundle.otherTypeObjectMessage;
                    otherTypeObjectMessage = messagingService.applyMessageParams( otherTypeObjectMessage, [ '{{otherObject}}' ], {
                        otherObject: otherObject
                    } );
                    otherObjErrorMessage = otherObjErrorMessage + '</br>' + otherTypeObjectMessage;
                    otherTypeObjectMessage = null;
                } );
                message += otherObjErrorMessage;
            }

            if ( releasedObjLength ) {
                // eslint-disable-next-line array-callback-return
                releasedPrgDelRevisionObjects.map( function( releasedPrgDelRevisionObject ) {
                    let releaseStatusErrorMsg = localTextBundle.releaseStatusErrorMsg;
                    releaseStatusErrorMsg = messagingService.applyMessageParams( releaseStatusErrorMsg, [ '{{releasedPrgDelRevisionObject}}' ], {
                        releasedPrgDelRevisionObject: releasedPrgDelRevisionObject
                    } );
                    releaseStatusErrorMessage = releaseStatusErrorMessage + '</br>' + releaseStatusErrorMsg;
                    releaseStatusErrorMsg = null;
                } );
                message += releaseStatusErrorMessage;
            }

            if ( simlilarObjLength !== 0 && simlilarObjLength + releasedObjLength >= 1 ) {
                let buttons = [ {
                    addClass: 'btn btn-notify',
                    text: data.i18n.CancelText,
                    onClick: function( $noty ) {
                        $noty.close();
                    }
                },
                {
                    addClass: 'btn btn-notify',
                    text: data.i18n.ProceedText,
                    onClick: function( $noty ) {
                        $noty.close();
                        commandPanelService.activateCommandPanel( commandId, location );
                        appCtxService.updateCtx( 'mselected', selectedPrgDelRevisionObjects );
                    }
                }
                ];
                messagingService.showWarning( message, buttons );
            } else {
                messagingService.showError( message );
            }
        }
    }
    if ( !message ) {
        commandPanelService.activateCommandPanel( commandId, location );
    }
};

export let checkForExistingResourcePoolAndDelete = function( ctx, data ) {
    let relationsObj = [];
    let selectedObjects = ctx.mselected;
    selectedObjects.forEach( function( selectedObject ) {
        if ( selectedObject.modelType.typeHierarchyArray.indexOf( 'Psi0PrgDelRevision' ) > -1 ) {
            selectedObject = cdm.getObject( selectedObject.uid );
            if ( selectedObject.props.psi0ResourceAssignment && selectedObject.props.psi0ResourceAssignment.dbValues.length > 0 ) {
                let relationObject = {
                    primaryObject : selectedObject,
                    secondaryObject: {
                        uid: selectedObject.props.psi0ResourceAssignment.dbValues[0],
                        type: 'Resource Pool'
                    },
                    relationType: 'Prg0ResourceAssignment'
                };
                relationsObj.push( relationObject );
            }
        }
    } );
    if ( relationsObj.length ) {
        var delRelInput = {
            input: relationsObj
        };
        soaSvc.post( 'Core-2006-03-DataManagement', 'deleteRelations', delRelInput );
    }
};

export let getObjectsWithRelation = function( ctx, selectedResourcePools ) {
    let input = [];
    let selectedObjects = ctx.mselected;

    selectedObjects.forEach( function( selectedObject ) {
        if ( selectedObject.modelType.typeHierarchyArray.indexOf( 'Psi0PrgDelRevision' ) > -1 ) {
            let inputData = {
                primaryObject: selectedObject,
                secondaryObject: selectedResourcePools[0],
                relationType: 'Prg0ResourceAssignment',
                clientId: 'CreateObject',
                userData: ''
            };
            input.push( inputData );
        }
    } );
    return input;
};

export let getPropagateUsersInput = function( ctx ) {
    let contextObj = cdm.getObject( ctx.mselected[0].uid );
    let delObjs = contextObj.modelType.typeHierarchyArray.indexOf( 'Prg0AbsEvent' ) > -1 ? contextObj.props.Psi0EventPrgDel.dbValues : contextObj.props.Psi0PlanPrgDel.dbValues;

    return [
        {
            parentObject: contextObj
        }
    ];
};

/**
 * prepare the input for set properties SOA call to remove the responsible User
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Object} dataProvider - The data provider that will be used to get the correct content
 */
export let removeResponsibleUser = function( data, ctx ) {
    let inputData = [];

    let selected = ctx.mselected;

    selected.forEach( function( selectedTask ) {
        let infoObj = {};
        let selectedObj = cdm.getObject( selectedTask.uid );
        if( selectedObj ) {
            infoObj.object = selectedObj;
            infoObj.timestamp = '';

            let property = {};
            if( selectedTask.modelType.typeHierarchyArray.indexOf( 'Psi0Checklist' ) > -1 || selectedTask.modelType.typeHierarchyArray.indexOf( 'Psi0ChecklistQuestion' ) > -1 ) {
                property.name = 'psi0ResponsibleUser';
            } else {
                property.name = 'psi0ResponsibleUsr';
            }
            property.values = [ '' ];

            let vecNameVal = [];
            vecNameVal.push( property );

            infoObj.vecNameVal = vecNameVal;

            inputData.push( infoObj );
        }
    } );

    return inputData;
};

export default exports = {
    assignResourcePanel,
    getObjectsWithRelation,
    getPropagateUsersInput,
    checkForExistingResourcePoolAndDelete,
    removeResponsibleUser
};
