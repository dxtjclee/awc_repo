// Copyright (c) 2022 Siemens

/**
 * @module js/Arm0ShowBalloonPopupPanelView
 */
import appCtxService from 'js/appCtxService';
import appCtxSvc from 'js/appCtxService';
import ckeditorOperations from 'js/ckeditorOperations';
import cdm from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import eventBus from 'js/eventBus';
import _ from 'lodash';

var exports = {};
var eventData = {};

/**
 * Method to update the options.
 *
 * @param {Object} data - the data object of view model
 */
export let updateOptions = function( data ) {
    var actionItemsList = _.clone( data.actionItems );
    actionItemsList.dbValue = eventData.actionItemList;
    appCtxService.ctx.Arm0ShowActionPanelVisible = true;
    var requiredHeight = eventData.actionItemList.length * 47; // padding;
    var actionsBalloonPopup = document.getElementsByClassName( 'aw-requirement-actionsPanel' );
    if ( actionsBalloonPopup && actionsBalloonPopup[0].length > 0 && actionItemsList.dbValue.length === 2 ) {
        var panelScrollBody = actionsBalloonPopup[0].parentElement;
        panelScrollBody.style.height = requiredHeight    + 'px';
        // panelScrollBody.style.width =  '210px'; Set as default width .
    }else{
        var panelScrollBody = actionsBalloonPopup[0].parentElement;
        panelScrollBody.style.height = requiredHeight   + 'px';
    }
    return{
        actionItemsList:actionItemsList
    };
};

/**
 * register context for popup inside editor
 */
export let registerCxtForPopupChildSibling = function( data ) {
    var popupEventData = data.eventMap[ 'requirementDocumentation.registerCxtForChildSiblingPopup'];
    eventData = popupEventData;
    eventBus.publish( 'requirementDocumentationEditor.PopupForAddChildSibling', popupEventData );
};

/**
 * register context for popup inside editor
 */
export let registerCxtForPopupInsideEditor = function( data ) {
    var popupEventData = data.eventMap[ 'requirementDocEditor.registerCxtForPopup'];
    eventData = popupEventData;
    eventBus.publish( 'requirementDocumentationEditor.showPopupPanel', popupEventData );
};

/**
 * register context for show commands from on balloon popup
 */
export let registerCxtForBalloonPopup = function( data ) {
    //exports.closeExistingBalloonPopup();
    var balloonPopeventData = data.eventMap[ 'requirementDocumentation.registerCxtForBalloonPopup'];
    eventData = balloonPopeventData;
    eventBus.publish( 'requirementDocumentation.showBalloonPopupActionsPanel', balloonPopeventData );
};
/**
 * @param {Object} row - selected row from popup
 */
export let handleCommandSelection = function( selectedObject ) {
    var row = selectedObject.selectedRow;
    if( eventData.callback ) {
        eventData.callback( row.internalName );
    }
};

function _createinputForAddchildSiblingCommandVisibility (inputeventData) {
    var inputData;
  return  inputData = {
        getVisibleCommandsInfo: [{
            clientScopeURI: appCtxSvc.getCtx('sublocation.clientScopeURI') || '',
            selectionInfo: [{
                contextName: '',
                parentSelectionIndex: 1,
                selectedObjects: [{
                    uid: inputeventData.requirementElement
                   
                }]
            }, {
                contextName: '',
                parentSelectionIndex: -1,
                selectedObjects: [{
                    uid: inputeventData.requirementSpecElement
                }]
            }
            ],
            commandContextInfo: [{
                contextName: 'IsHosted',
                contextValue: 'false'
            },
            {
                contextName: 'HostType',
                contextValue: ''
            },
            {
                contextName: 'UrlParameter_uid',
                contextValue: ''
            }
            ],
            commandInfo: [{
                commandCollectionId: '',
                commandId: 'Awb0AddChildElement'
            },
            {
                commandCollectionId: '',
                commandId: 'Awb0AddSiblingElement'
            }
            ]
        }]
    };
    
}


/**
 * Updated reference for popup
 * @param {object} data - data
 * @param {Object} newRef - Query selector for reference
 * @param {Object} popupAction - popup action
 * @param {Object} eventData - selected object uid
 */
export let updateReferenceForChildSibling = function (data,  popupAction, inputeventData) {
    popupAction.update({ reference: eventData.targetElement });
    var validCommandList = [];
    var inputData=_createinputForAddchildSiblingCommandVisibility(inputeventData);
    
    var locationContext =appCtxSvc.getCtx('locationContext');
    if(inputeventData.sourceObject.uid.indexOf( 'RM::NEW' ) >-1 || locationContext && locationContext['ActiveWorkspace:SubLocation'] === 'htmlSpecSubLocation' ){
        validCommandList=['Awb0AddChildElement','Awb0AddSiblingElement'];
        data.dispatch({ path: 'data.visibleServerCommandsForRM', value: validCommandList });
        eventBus.publish('requirementDocumentation.showBalloonPopupForAddChildSibling');

    }else{
        soaSvc.postUnchecked('Internal-AWS2-2016-03-UiConfig', 'getVisibleCommands', inputData)
        .then(function (response) {
            if (response && response.visibleCommandsInfo) {
                let commands = response.visibleCommandsInfo;
              
                for (let index = 0; index < commands.length; index++) {
                    if (commands[index].commandId === 'Awb0AddChildElement') {
                        validCommandList.push('Awb0AddChildElement');
                    }
                    if (commands[index].commandId === 'Awb0AddSiblingElement') {
                        validCommandList.push('Awb0AddSiblingElement');
                    }
                }
            }
            data.dispatch({ path: 'data.visibleServerCommandsForRM', value: validCommandList });
            eventBus.publish('requirementDocumentation.showBalloonPopupForAddChildSibling');

        });
    }

   
};





/**
 * add child command for spec requirement
 * @param {object} data - data
 * @param {Object} newRef - Query selector for reference
 * @param {Object} popupAction - popup action
 * @param {Object} eventData - selected spec object uid
 */
export let addchildforSpec = function ( eventDat1a) {
    var editor = ckeditorOperations.getCKEditorInstance();
   
    const requirementElementuid = eventDat1a.requirementElement;
    const modelRequirement = ckeditorOperations.getCKEditorModelElementByUID(requirementElementuid);
    
 
     var inputData=_createinputForAddchildSiblingCommandVisibility(eventDat1a);
        //for showing  warnning message when user do not have access rights.
    // var revisionidReq = modelRequirement._attrs.get('revisionid');
    // var reqObject = cdm.getObject(revisionidReq);
    // var specname=reqObject.props.object_string.dbValues[0];

    soaSvc.postUnchecked('Internal-AWS2-2016-03-UiConfig', 'getVisibleCommands', inputData)
        .then(function (response) {
            if (response && response.visibleCommandsInfo) {
                let commands = response.visibleCommandsInfo;
                var validCommandList = [];
                for (let index = 0; index < commands.length; index++) {
                    if (commands[index].commandId === 'Awb0AddChildElement') {
                        validCommandList.push('Awb0AddChildElement');
                    }
                }
            }

            if(validCommandList.includes('Awb0AddChildElement')){
                editor.execute( 'insertRequirement', { after: modelRequirement, addOption: 'CHILD' } );
            }else {
                console.warn("Child was not added because you do not have access rights.");
                // var eventData={
                //     specname:specname
                // };
               // eventBus.publish('requirementDocumentation.showwarningMessageFromAddchildFailureforSpec',eventData);
            }
            
        });
};
/**
 *Add child for Requirement Spec
 */
 export let addChildSiblingElementOfRequirement = function ( commandContext,istype  ) {

    var editor = ckeditorOperations.getCKEditorInstance();
    const requirementElementuid = commandContext.eventData.requirementElement;
    const modelRequirement = ckeditorOperations.getCKEditorModelElementByUID(requirementElementuid);
    if (istype ==='child') {
        editor.execute('insertRequirement', { after: modelRequirement, addOption: 'CHILD' });
        eventBus.publish('showActionPopup.close');
     } else if (istype === 'sibling') {
         editor.execute('insertRequirement', { after: modelRequirement, addOption: 'SIBLING' });
         eventBus.publish('showActionPopup.close');
     }

};


export default exports = {
    updateOptions,
    registerCxtForBalloonPopup,
    handleCommandSelection,
    registerCxtForPopupInsideEditor,
    registerCxtForPopupChildSibling,
    updateReferenceForChildSibling,
    addchildforSpec,
    addChildSiblingElementOfRequirement
};
