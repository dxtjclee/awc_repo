
import senPLFCellRenderer from 'js/senPLFCellRenderer';
import appCtxSvc from 'js/appCtxService';
import { includeComponent } from 'js/moduleLoader';
import { renderComponent, unmountComponents } from 'js/declReactUtils';


/**
  * Calls methods to get Usage PLF property value as cell text element. Appends it to the container element.
  *
  * @param {Object} vmo the vmo for the cell
  * @param {DOMElement} containerElement containerElement
  * @param {Object} columnName the column associated with the cell
  *
  */
export let usagePLFRenderer = function( vmo, containerElement, columnName ) {
    let refObj = {};
    let usagePLFValue = 'No PLF';
    let mroPartList = appCtxSvc.getCtx( 'MROPartList' );
    let mroPart;
    if( mroPartList ) {
        for ( let index = 0; index < mroPartList.length; index++ ) {
            if( mroPartList[index].partId === vmo.uid ) {
                mroPart = mroPartList[index];
                break;
            }
        }

        let updatedIsUsage;

        if( mroPart && mroPart.partId === vmo.uid && vmo.levelNdx > 0 ) {
            usagePLFValue = mroPart.updatedIsUsage !== undefined ? mroPart.updatedIsUsage : mroPart.isUsage;
            updatedIsUsage =  mroPart.updatedIsUsage;
        }

        refObj = {
            vmo:vmo,
            usagePLFValue : usagePLFValue
        };
        getIconCellElement( refObj, containerElement, columnName, vmo, updatedIsUsage );
    }
};

export const getIconCellElement = function( refObj, parentElement, propName, vmo, updatedIsUsage ) {
    let attributeValue = senPLFCellRenderer.getAttributeValue( refObj, propName );

    let icon = getIconSource( attributeValue );
    let contextObject = { vmo:refObj.vmo };
    contextObject.usagePLFValue = refObj.usagePLFValue === 'No PLF' ? 'noPLF' : refObj.usagePLFValue === false ? 'itemLevelPLF' : 'usageLevelPLF';
    let props = {
        iconName: icon,
        tooltipViewName:'SenUsagePLFTooltip',
        propName: propName,
        tooltipOptions: { placement : 'right' },
        contextObject:contextObject
    };
    if( !appCtxSvc.getCtx( 'isEditButtonClicked' ) && attributeValue || appCtxSvc.getCtx( 'isEditButtonClicked' ) && attributeValue && updatedIsUsage === undefined ) {
        props.className = 'aw-sen-disabled';
    }
    let iconElement = includeComponent( 'SenCellIcon', props );
    let api = function() {
        parentElement.classList.add( 'aw-sen-visual-indicator' );
        refObj.vmo = vmo;
        addUsagePlfIndication( parentElement, refObj.usagePLFValue );
        parentElement.onclick = function( event ) {
            if( appCtxSvc.getCtx( 'editInProgress' ) ) {
                unmountComponents( this.childNodes[0] );
                senPLFCellRenderer.updatePlfValue( attributeValue, refObj, propName, parentElement );
            }
        };
    };
    if ( parentElement ) {
        renderComponent( iconElement, parentElement, api );
    }
    return null;
};

/**
 * Gets icon image source based on parameters given
 *
 * @param {String} attributeValue the value of the plf attribute
 *
 */
let getIconSource = function( attributeValue ) {
    let imagePath = '';

    if( attributeValue === true ) {
        imagePath = 'miscUiCheckboxSelected18.svg';
    } else if( attributeValue === false ) {
        imagePath = 'miscUiCheckboxUnselectedPressed18.svg';
    } else {
        imagePath = 'cmdCancel24.svg';
    }
    return imagePath;
};

/**
 * Update UI indication as per usage PLF value
 *
 */
let addUsagePlfIndication = function( parentElement, usagePLFValue ) {
    if( usagePLFValue === true ) {
        parentElement.classList.add( 'aw-jswidgets-editableGridCell' );
        parentElement.classList.add( 'aw-sen-bordered-cell' );
        if( appCtxSvc.getCtx( 'isEditButtonClicked' ) ) {
            parentElement.classList.add( 'aw-sen-cell-highlight' );
        }
    }
};

export default {
    usagePLFRenderer,
    getIconCellElement
};

