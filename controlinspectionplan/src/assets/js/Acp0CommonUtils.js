// Copyright (c) 2022 Siemens

/**
 * This file is used as utility file for Rule, Naming Convention, Condition Object oprtaions.
 * @module js/Acp0CommonUtils
 */
var exports = {};

/*
 * This method to return the property lists which needs to be loaded
 */
export function _toPreparePropstoLoadData( selectedCondObj, propsToLoad ) {
    var propsToLoadData = [];
    for( var prop of propsToLoad ) {
        if( !selectedCondObj.props.prop ) {
            propsToLoadData.push( prop );
        }
    }
    return propsToLoadData;
}

export default exports = {
    _toPreparePropstoLoadData
};
