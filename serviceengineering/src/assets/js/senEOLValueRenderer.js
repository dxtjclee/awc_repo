import appCtxSvc from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import eventBus from 'js/eventBus';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import senPLFCellRenderer from 'js/senPLFCellRenderer';
import popupService from 'js/popupService';
import senEndOfLifeService from 'js/senEndOfLifeService';
import senPLFTablePropertyRenderer from 'js/senPLFTablePropertyRenderer';
import senCreateEOLService from 'js/senCreateEOLService';
import notyService from 'js/NotyModule';
import TypeDisplayNameService from 'js/typeDisplayName.service';
import localeService from 'js/localeService';
import { includeComponent } from 'js/moduleLoader';
import { renderComponent } from 'js/declReactUtils';

const MROPARTLIST = 'MROPartList';
const EOLANDPARTMAP = 'eolAndPartMap';
const ISEDITBUTTONCLICKED = 'isEditButtonClicked';
const SETEOL = 'setEOL';
const SETEOLEDIT = 'setEOLEdit';
const EDITEOL = 'editEOL';
const EDITEOLEDIT = 'editEOLEdit';
const REMOVEEOL = 'removeEOL';
const REMOVEEOLEDIT = 'removeEOLEdit';
/*
 * Calls methods to get Usage PLF property value as cell text element. Appends it to the container element.
 *
 * @param {Object} vmo the vmo for the cell
 * @param {DOMElement} containerElement containerElement
 *
 */

let EOLValueRenderer = function( vmo, containerElement ) {
    let refobj = {
        usagePLFValue :false
    };
    const mroPartList = appCtxSvc.getCtx( MROPARTLIST );
    if( mroPartList  ) {
        let mroPart;
        for ( let index = 0; index < mroPartList.length; index++ ) {
            if( mroPartList[index].partId === vmo.uid ) {
                mroPart = mroPartList[index];
                break;
            }
        }
        if( mroPart ) {
            let plfPropertyName = senPLFCellRenderer.getPropNameIndb( 'lifeLimitedValueColumn' );
            refobj = senPLFTablePropertyRenderer.getRefObjectBasedOnPLFProp( plfPropertyName, mroPart, vmo );
            let iconElement = senPLFCellRenderer.getIconCellElement( refobj, containerElement, 'lifeLimitedValueColumn', vmo );
            if( iconElement !== null ) {
                containerElement.appendChild( iconElement );
            }
            if( refobj.plfValue === true && appCtxSvc.getCtx( 'tcReleaseIsAtleast143' ) ) {
                let eolOnCurrentVmo = getEOLOnCurrentVmo( vmo, refobj.usagePLFValue );
                if ( eolOnCurrentVmo !== null ) {
                    getEolDurationUnitTextElement( eolOnCurrentVmo, containerElement, vmo );
                    getRemoveEolIconElement( containerElement, vmo );
                } else{
                    getEndOfLifeIconCellElement( refobj, containerElement, 'lifeLimitedValueColumn', vmo );
                }
            }
        }else{
            let iconElement = senPLFCellRenderer.getIconCellElement( refobj, containerElement, 'lifeLimitedValueColumn', vmo );
            if( iconElement !== null ) {
                containerElement.appendChild( iconElement );
            }
        }
    }
};
/**
 * Calls methods to get set icon element. Appends it to the container element.
 *
 * @param {Object} refObj the refernce object with PLF uid/vmo uid and plfValue/usagePlf value for the cell
 * @param {DOMElement} parentElement parent element of the cell
 * @param {String} columnName  the column associated with the cell
 * @param {Object} vmo the vmo for the cell
 *
 * @returns {DOMElement} icon element
 */
let getEndOfLifeIconCellElement = function( refObj, parentElement, columnName, vmo ) {
    const icon = 'indicatorEndOfLife16';
    let contextObject = { vmo:vmo };
    appCtxSvc.getCtx( ISEDITBUTTONCLICKED ) ? contextObject.eolValue = SETEOLEDIT : contextObject.eolValue = SETEOL;
    let props = {
        iconName: icon,
        tooltipViewName:'SenEndOfLifeTooltip',
        propName: columnName,
        tooltipOptions: { placement : 'right' },
        contextObject:contextObject
    };
    props.className = 'aw-sen-setEolIcon';
    let iconElement = includeComponent( 'SenCellIcon', props );
    let iconElementContainer = document.createElement( 'div' );
    parentElement.appendChild( iconElementContainer );

    if( parentElement ) {
        let setEOLTitle = senPLFCellRenderer.getLocalizedMessage( 'senMessages', 'setEOLPopupTitle', null );
        senPLFCellRenderer.addUsagePlfIndication( parentElement, refObj.usagePLFValue );
        let api = function() {
            refObj.vmo = vmo;
            iconElementContainer.onclick = function( event ) {
                if( !appCtxSvc.getCtx( 'editInProgress' ) ) {
                    iconElementContainer = event.currentTarget;
                    const popupParams = {
                        caption: setEOLTitle,
                        view: 'SenSetAndEditEOLPopup',
                        preset: 'modal',
                        height: 'auto',
                        maxheight: '550',
                        width: '450',
                        clickOutsideToClose: false,
                        draggable: true,
                        enableResize: true,
                        independent: true,
                        subPanelContext: {
                            vmo:[ vmo ],
                            actionType:'set'
                        }
                    };
                    popupService.show( popupParams );
                }
            };
        };

        if ( parentElement ) {
            renderComponent( iconElement, iconElementContainer, api );
        }

        return iconElement;
    }
    return null;
};
/**
 * Calls methods to get End of life object associated with the vmo of cell passed.
 *
 * @param {Object} vmo the vmo for the cell
 *
 * @returns {Object} End of life object
 */

let getEOLOnCurrentVmo = function( vmo, isUsagePLFValue ) {
    const inputVmo = cdm.getObject( vmo.uid );
    let eolOnCurrentVmo = null;
    if( inputVmo ) {
        const eolAndPartMap = appCtxSvc.getCtx( EOLANDPARTMAP );
        if( eolAndPartMap ) {
            for( let keys of eolAndPartMap ) {
                const uidToSearch = isUsagePLFValue ? inputVmo.uid : cdm.getObject( cdm.getObject( inputVmo.props.awb0UnderlyingObject.dbValues[0] ).props.items_tag.dbValues[0] ).uid;
                if( keys[0] === uidToSearch ) {
                    const eolRevList = senEndOfLifeService.getEOLRevisionListByCreationDate( cdm.getObject( keys[1] ) );
                    if( eolRevList[ 0 ] ) {
                        eolOnCurrentVmo = eolRevList[ 0 ];
                    }
                    break;
                }
            }
        }
    }
    return eolOnCurrentVmo;
};
/**
 * Calls methods to get text element for duration and unit. Appends it to the container element.
 *
 * @param {Object} EOL the refernce object with PLF uid/vmo uid and plfValue/usagePlf value for the cell
 * @param {DOMElement} containerElement parent element of the cell
 * @param {Object} vmo Vmo of the cell
 *
 * @returns {DOMElement} icon element
 */
let getEolDurationUnitTextElement = function( EOL, containerElement, vmo ) {
    let contextObject = { vmo:vmo };
    let eolText = getEOLDurationString( EOL );
    appCtxSvc.getCtx( ISEDITBUTTONCLICKED ) ? contextObject.eolValue = EDITEOLEDIT : contextObject.eolValue = EDITEOL;
    contextObject.eolText = eolText;
    let props = {
        eolText: eolText,
        tooltipViewName:'SenEndOfLifeTooltip',
        propName: 'lifeLimitedValueColumn',
        tooltipOptions: { placement : 'right' },
        contextObject:contextObject
    };
    props.className = 'aw-sen-editEolIcon';
    let durationTextElement = includeComponent( 'SenCellText', props );
    let durationTextElementContainer = document.createElement( 'div' );
    durationTextElementContainer.style.width = '70%';
    containerElement.appendChild( durationTextElementContainer );

    if ( containerElement ) {
        let editEOLTitle = senPLFCellRenderer.getLocalizedMessage( 'senMessages', 'setEOLPopupTitle', null );
        let api = function() {
            durationTextElementContainer.onclick = function( event ) {
                if( !appCtxSvc.getCtx( 'editInProgress' ) ) {
                    durationTextElementContainer = event.currentTarget;
                    const popupParams = {
                        caption: editEOLTitle,
                        view: 'SenSetAndEditEOLPopup',
                        preset: 'modal',
                        height: 'auto',
                        maxheight: '550',
                        width: '450',
                        clickOutsideToClose: false,
                        draggable: true,
                        enableResize: true,
                        independent: true,
                        subPanelContext: {
                            vmo:[ EOL ],
                            actionType:'edit'
                        }
                    };
                    popupService.show( popupParams );
                }
            };
        };

        renderComponent( durationTextElement, durationTextElementContainer, api );
        return durationTextElement;
    }
    return null;
};
/**
 * Calls methods to get remove icon element. Appends it to the container element.
 *
 * @param {DOMElement} containerElement parent element of the cell
 * @param {Object} vmo vmo of the cell
 *
 * @returns {DOMElement} icon element
 */
let getRemoveEolIconElement = function(  containerElement, vmo, refobj ) {
    if ( containerElement ) {
        let icon = 'cmdRemove24';
        let contextObject = { vmo:vmo };
        appCtxSvc.getCtx( ISEDITBUTTONCLICKED ) ? contextObject.eolValue = REMOVEEOLEDIT : contextObject.eolValue = REMOVEEOL;
        let props = {
            iconName: icon,
            tooltipViewName:'SenEndOfLifeTooltip',
            propName: 'lifeLimitedValueColumn',
            tooltipOptions: { placement : 'right' },
            contextObject:contextObject
        };
        props.className = 'aw-sen-removeEolIcon';
        let removeEolElement = includeComponent( 'SenCellIcon', props );
        let iconElementContainer = document.createElement( 'div' );
        containerElement.appendChild( iconElementContainer );

        let api = function() {
            iconElementContainer.onclick = function( ) {
                if( !appCtxSvc.getCtx( 'editInProgress' ) ) {
                    let selectedObjDispName = TypeDisplayNameService.instance.getDisplayName( vmo );
                    showConfirmationMessageForRemove( selectedObjDispName );
                }
            };
        };

        if ( containerElement ) {
            renderComponent( removeEolElement, iconElementContainer, api );
        }
        return removeEolElement;
    }
    return null;
};
/**
 * Calls methods to get Duration unit combined string from EOL object.
 *
 * @param {Object} EOL End of life object from which we need the duration and unit
 *
 * @returns {String} duration unit string
 */
let getEOLDurationString = function( EOL ) {
    let duration = EOL.props.smr0Duration.uiValues[ 0 ];
    let durationUnit = EOL.props.smr0DurationUnit.uiValues[ 0 ];
    return Math.round( duration ) + ' ' + durationUnit;
};
/**
 * Method to show warning message with 'Cancel' and 'Remove' buttons.
 *
 * @param {String} selectedObjDispName Display name of child part object for the cell
 *
 */
let showConfirmationMessageForRemove = async function( selectedObjDispName ) {
    let localTextBundle = localeService.getLoadedText( 'senMessages' );
    var msg = localTextBundle.senRemoveEOLConfirmation.replace( '{0}', selectedObjDispName );
    var buttons = [ {
        addClass: 'btn btn-notify',
        text: localTextBundle.CancelEOLText,
        onClick: function( $noty ) {
            $noty.close();
        }
    }, {
        addClass: 'btn btn-notify',
        text: localTextBundle.removeEOL,
        onClick: function( $noty ) {
            $noty.close();
            deleteRelationBetweenEOLAndPart();
        }
    } ];

    notyService.showWarning( msg, buttons );
};
/**
 * Method to delete Relation between EOL and part and also refreshes the table.
 *
 * @returns {Promise} promise
 *
 */
let deleteRelationBetweenEOLAndPart = function() {
    var deferred = AwPromiseService.instance.defer();
    let selectedObj = appCtxSvc.getCtx( 'selected' );
    let removeEOLInput = getRemoveEOLInput( selectedObj );
    soaSvc.postUnchecked( 'Core-2006-03-DataManagement', 'deleteObjects', removeEOLInput ).then( function(  ) {
        senCreateEOLService.registerEOL( removeEOLInput.objects[0], 'remove' );
        eventBus.publish( 'senCreateOrRemove.updateEOLOnSelectedPart' );
        eventBus.publish( 'senSbomTreeTable.plTable.clientRefresh' );
        deferred.resolve();
    } );
    return deferred.promise;
};

/**
 * This method creates input for deleteRelations SOA.
 *
 * @param {Object} selectedPartRuntime Awb0Element of the selected part
 * @returns {Promise} promise
 *
 */
let getRemoveEOLInput = function( selectedPartRuntime ) {
    let selectedPart = cdm.getObject( cdm.getObject( selectedPartRuntime.props.awb0UnderlyingObject.dbValues[0] ).props.items_tag.dbValues[0] );
    let eolAndPartMap = appCtxSvc.getCtx( 'eolAndPartMap' );
    let EOL = null;
    if( eolAndPartMap ) {
        const mroPartList = appCtxSvc.getCtx( 'MROPartList' );
        let mroPart = null;
        if( mroPartList ) {
            for( let index = 0; index < mroPartList.length; index++ ) {
                if( mroPartList[ index ].partId === selectedPartRuntime.uid ) {
                    mroPart = mroPartList[ index ];
                    break;
                }
            }
        }
        if( mroPart ) {
            const isUsage = mroPart.isUsage;
            for( let keys of eolAndPartMap ) {
                const uidToSearch =  isUsage ? selectedPartRuntime.uid : selectedPart.uid;
                if( keys[0] === uidToSearch ) {
                    EOL = cdm.getObject( keys[1] );
                    break;
                }
            }
        }
    }
    return {
        objects: [ EOL ]
    };
};

export default {
    EOLValueRenderer,
    getEOLDurationString,
    getEndOfLifeIconCellElement
};
