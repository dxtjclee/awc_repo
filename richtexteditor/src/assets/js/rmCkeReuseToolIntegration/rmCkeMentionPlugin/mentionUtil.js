/**
 * Transforms object or iterable to map. Iterable needs to be in the format acceptable by the `Map` constructor.
 *
 *      map = toMap( { 'foo': 1, 'bar': 2 } );
 *      map = toMap( [ [ 'foo', 1 ], [ 'bar', 2 ] ] );
 *      map = toMap( anotherMap );
 *
 * @param {Object|Iterable} data Object or iterable to transform.
 * @returns {Map} Map created from data.
 */
export default function toMap( data ) {
    if ( isIterable( data ) ) {
        return new Map( data );
    }
    return objectToMap( data );
}


/**
 * Checks if value implements iterator interface.
 *
 * @param {*} value The value to check.
 * @returns {Boolean} True if value implements iterator interface.
 */
export function isIterable( value ) {
    return Boolean( value && value[ Symbol.iterator ] );
}

/**
 * Transforms object to map.
 *
 *  const map = objectToMap( { 'foo': 1, 'bar': 2 } );
 *  map.get( 'foo' ); // 1
 *
 * **Note**: For mixed data (`Object` or `Iterable`) there's a dedicated {@link module:utils/tomap~toMap} function.
 *
 * @param {Object} obj Object to transform.
 * @returns {Map} Map created from object.
 */
export function objectToMap( obj ) {
    const map = new Map();
    for ( const key in obj ) {
        map.set( key, obj[ key ] );
    }
    return map;
}
