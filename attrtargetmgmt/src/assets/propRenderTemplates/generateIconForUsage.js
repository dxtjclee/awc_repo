// Copyright (c) 2022 Siemens

/**
 * native construct to hold the server version information related to the AW server release.
 *
 * @module propRenderTemplates/generateIconForUsage
 */
import { getBaseUrlPath } from 'app';

var exports = {};

export let generateIconForUsageFn = function( vmo, containerElem ) {
    var usage = null;
    var usageDisplayVal = null;

    let cellImg = document.createElement( 'img' );
    cellImg.className = 'aw-visual-indicator';
    let imagePath = getBaseUrlPath() + '/image/';

    if( vmo.props && vmo.props.att1AttrInOut && vmo.props.att1AttrInOut.dbValue ) {
        usage = vmo.props.att1AttrInOut.dbValue;
        usageDisplayVal = vmo.props.att1AttrInOut.displayValues[ 0 ];

        if( usage === 'output' ) {
            imagePath += 'cmdSetMeasureableAttributeOutput24.svg';
        } else if( usage === 'input' ) {
            imagePath += 'cmdSetMeasurableAttributeInput24.svg';
        } else if( usage === 'unused' ) {
            imagePath += 'cmdShowUnusedAttributes24.svg';
        } else {
            imagePath += 'cmdSetMeasurableAttribute' + usage + '24.svg';
        }

        cellImg.title = usageDisplayVal;
        cellImg.src = imagePath;
        containerElem.appendChild( cellImg );
    } else if( vmo.props && vmo.props.att1Direction && vmo.props.att1Direction.dbValue ) {
        usage = vmo.props.att1Direction.dbValue;
        usageDisplayVal = vmo.props.att1Direction.displayValues[ 0 ];

        if( usage === 'output' ) {
            imagePath += 'cmdSetMeasureableAttributeOutput24.svg';
        } else if( usage === 'input' ) {
            imagePath += 'cmdSetMeasurableAttributeInput24.svg';
        } else if( usage === 'unused' ) {
            imagePath += 'cmdShowUnusedAttributes24.svg';
        } else {
            imagePath += 'cmdSetMeasurableAttribute' + usage + '24.svg';
        }

        cellImg.title = usageDisplayVal;
        cellImg.src = imagePath;
        containerElem.appendChild( cellImg );
    }
};

export default exports = {
    generateIconForUsageFn
};
