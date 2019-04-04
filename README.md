A Demo for Running PouchDB on React Native with SQlite3
====================================================

Please read [this blogpost](https://dev.to/craftzdog/hacking-pouchdb-to-use-on-react-native-1gjh).

## How I hacked PouchDB

To get it to work on React Native with attachments support, we need to avoid calling `FileReader.readAsArrayBuffer` from PouchDB core modules since RN does not support it yet.
That means we always process attachments in Base64 instead of `Blob`.
It can be done with [a few lines of code hacks](https://github.com/craftzdog/pouchdb-react-native/commit/78de4baad85c30d8dc41e0609cff894d44cc6d33).

### Where `readAsArrayBuffer` is called

PouchDB tries to calclulate MD5 digest for every document, which needs to call `readAsArrayBuffer`.

In `pouchdb-binary-utils/lib/index-browser.js`:

```js
72 function readAsBinaryString(blob, callback) {
73   if (typeof FileReader === 'undefined') {
74     // fix for Firefox in a web worker
75     // https://bugzilla.mozilla.org/show_bug.cgi?id=901097
76     return callback(arrayBufferToBinaryString(
77       new FileReaderSync().readAsArrayBuffer(blob)));
78   }
79
80   var reader = new FileReader();
81   var hasBinaryString = typeof reader.readAsBinaryString === 'function';
82   reader.onloadend = function (e) {
83     var result = e.target.result || '';
84     if (hasBinaryString) {
85       return callback(result);
86     }
87     callback(arrayBufferToBinaryString(result));
88   };
89   if (hasBinaryString) {
90     reader.readAsBinaryString(blob);
91   } else {
92     reader.readAsArrayBuffer(blob);
93   }
94 }
```

This function is called from `pouchdb-md5/lib/index-browser.js`:

```js
24 function appendBlob(buffer, blob, start, end, callback) {
25   if (start > 0 || end < blob.size) {
26     // only slice blob if we really need to
27     blob = sliceBlob(blob, start, end);
28   }
29   pouchdbBinaryUtils.readAsArrayBuffer(blob, function (arrayBuffer) {
30     buffer.append(arrayBuffer);
31     callback();
32   });
33 }
```

Well, how to avoid that?

### Storing Attachments

Disable `binary` option of `getAttachment` method in `pouchdb-core/src/adapter.js` like so:

```js
714     if (res.doc._attachments && res.doc._attachments[attachmentId]
715       opts.ctx = res.ctx;
716       // force it to read attachments in base64
717       opts.binary = false;
718       self._getAttachment(docId, attachmentId,
719                           res.doc._attachments[attachmentId], opts, callback);
720     } else {
```

With this change, you will always get attachments encoded in base64.

### Pull Replication

We have to convert blob to base64 when fetching attachments from remote database in `pouchdb-replication/lib/index.js` like so:

```js
function getDocAttachmentsFromTargetOrSource(target, src, doc) {
  var doCheckForLocalAttachments = pouchdbUtils.isRemote(src) && !pouchdbUtils.isRemote(target);
  var filenames = Object.keys(doc._attachments);

  function convertBlobToBase64(attachments) {
    return Promise.all(attachments.map(function (blob) {
      if (typeof blob === 'string') {
        return blob
      } else {
        return new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = function() {
            const uri = reader.result;
            const pos = uri.indexOf(',')
            const base64 = uri.substr(pos + 1)
            resolve(base64)
          }
        });
      }
    }));
  }

  if (!doCheckForLocalAttachments) {
    return getDocAttachments(src, doc)
      .then(convertBlobToBase64);
  }

  return target.get(doc._id).then(function (localDoc) {
    return Promise.all(filenames.map(function (filename) {
      if (fileHasChanged(localDoc, doc, filename)) {
        return src.getAttachment(doc._id, filename);
      }

      return target.getAttachment(localDoc._id, filename);
    }))
      .then(convertBlobToBase64);
  }).catch(function (error) {
    /* istanbul ignore if */
    if (error.status !== 404) {
      throw error;
    }

    return getDocAttachments(src, doc)
      .then(convertBlobToBase64);
  });
}
```

That worked!
And that's why I made both `@craftzdog/pouchdb-core-react-native` and `@craftzdog/pouchdb-replication-react-native`.
If you found any problem on them, pull requests would be welcomed [here](https://github.com/craftzdog/pouchdb-react-native).

