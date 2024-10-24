// Copyright (c) 2022 Siemens

/**
 * Service for rendering Object ACL table icons
 *
 * @module propRenderTemplates/Am0ACLTableIconRenderer
 */

var exports = {};

/*
 * @param {Object} vmo - the ViewModelObject for the cell
 * @param {Object} containerElem - the icon container element
 * @param {Object} column - the column associated with the cell
 */
export let renderPrivilegeIcons = function( vmo, containerElem, column ) {
    if( column === 'AccessorType' ) {
        let childElement = document.createElement( 'div' );
        childElement.className = 'aw-splm-tableCellText';
        let displayValue = vmo.props[ column ].uiValue;
        if( displayValue ) {
            childElement.innerHTML += displayValue;
            containerElem.appendChild( childElement );
        }
    } else if ( column === 'Accessor' ) {
        let childElement = document.createElement( 'div' );
        childElement.className = 'aw-splm-tableCellText';

        let displayValue = vmo.props[ column ].uiValue;
        if( displayValue ) {
            childElement.innerHTML += displayValue;
            containerElem.appendChild( childElement );
        }
    } else {
        let priv = vmo.props[ column ];
        if( priv.dbValue ) {
            if( priv.dbValue === 'Allow' ) {
                var imagePath = 'assets/image/indicatorApprovedPass16.svg';
            } else if( priv.dbValue === 'Deny' ) {
                imagePath = 'assets/image/indicatorNo16.svg';
            }
            let cellImg = document.createElement( 'img' );
            cellImg.src = imagePath;
            containerElem.appendChild( cellImg );
        }
    }
};

/**
 * This method is rendering icons for READ & WRITE columns of Attribute ACE table
 * @param {Object} vmo - the ViewModelObject for the cell
 * @param {Object} containerElem - the icon container element
 * @param {Object} column - the column associated with the cell
 */
export let renderAttrPrivilegeIcons = function(vmo, containerElem, column){
    vmo.props[ column ].emptyLOVEntry = false;
    let priv = vmo.props[ column ];
    if( priv.dbValue ) {
        if( priv.dbValue === 'Allow' ) {
            var imagePath = 'assets/image/indicatorApprovedPass16.svg';
        } else if( priv.dbValue === 'Deny' ) {
            imagePath = 'assets/image/indicatorNo16.svg';
        }
        let cellImg = document.createElement( 'img' );
        cellImg.src = imagePath;
        containerElem.appendChild( cellImg );
    }
};

export default exports = {
    renderPrivilegeIcons,
    renderAttrPrivilegeIcons
};
