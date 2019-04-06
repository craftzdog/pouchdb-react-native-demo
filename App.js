import React, { Component } from 'react'
import { StyleSheet, Text, View, FlatList, SafeAreaView } from 'react-native'

import PouchDB from './pouchdb'

let db

export default class ReactNativeSQLite2Test extends Component {
  constructor(props) {
    super(props)
    this.state = {
      progress: [{ msg: 'Welcome', key: 'welcome' }]
    }
  }

  componentWillUnmount() {
    this.destroyDatabase()
  }

  addLog(msg) {
    if(typeof msg === 'object') {
      msg = JSON.stringify(msg);
    }
    console.log(msg)
    const { progress } = this.state
    this.setState({
      progress: [...progress, { msg, key: (+new Date()).toString() }]
    })
  }

  errorCB = err => {
    console.error('error:', err)
    this.addLog('Error: ' + (err.message || err))
    return false
  }

  successCB = () => {
    console.log('SQL executed ...')
  }

  openCB = () => {
    this.addLog('Database OPEN')
    this.setState(this.state)
  }

  closeCB = () => {
    this.addLog('Database CLOSED')
  }

  deleteCB = () => {
    this.addLog('Database DELETED')
  }

  async openDatabase() {
    db = new PouchDB('mydb.db', { adapter: 'react-native-sqlite' })
  }

  async resetDatabase() {
    await this.openDatabase()
    await this.destroyDatabase()
    await this.openDatabase()
  }

  async destroyDatabase() {
    this.addLog('Destroying db..')
    await db.destroy()
    this.addLog('Destroying db completed')
  }

  async populateDatabase() {
    try {
      await db.put({
        _id: 'note:foobar',
        body: 'hello',
        _attachments: {
          'test.txt': {
            content_type: 'text/plain',
            data: 'aGVsbG8sIHdvcmxk' // hello, world
          }
        }
      })

      const view = {
        _id: '_design/notes',
        views: {
          notes: {
            map: function(doc) {
              if (doc._id.startsWith('note:')) {
                emit(['notes', doc._id])
              }
            }.toString()
          }
        }
      }
      await db.put(view)

      // const res = await db.allDocs({ include_docs: true, attachments: true })
      const res = await db.query('notes', {
        include_docs: true,
        attachments: true
      })
      this.addLog('Query result: ' + JSON.stringify(res))

      /* Uncomment this to test syncing with CouchDB
       *
      this.remoteDB = new PouchDB(
        'http://YOUR_SERVER:5984/react-native-push-test'
      )
      this.addLog("Fetching remote DB info...");
      await this.remoteDB.info().then(info => this.addLog(info));
      db.sync(this.remoteDB, { live: true }).on('error', this.errorCB)
      */

      this.addLog('Done!')
    } catch (e) {
      this.errorCB(e)
    }
  }

  async loadAndQueryDB() {
    this.addLog('Initialize db')
    await this.resetDatabase()
    db.changes({ live: true, since: 'now', include_docs: true })
      .on('change', async info => {
        this.addLog('db changed: ' + info.id)
      })
      .on('error', this.errorCB)
    await this.populateDatabase()
  }

  runDemo() {
    this.addLog('Starting PouchDB on React Native demo')
    this.loadAndQueryDB()
  }

  renderProgressEntry = entry => {
    const { item } = entry
    return (
      <View style={listStyles.li}>
        <View>
          <Text style={listStyles.liText}>{item.msg}</Text>
        </View>
      </View>
    )
  }

  render() {
    const { progress } = this.state
    return (
      <SafeAreaView style={styles.mainContainer}>
        <View style={styles.toolbar}>
          <Text style={styles.toolbarButton} onPress={() => this.runDemo()}>
            Run Demo
          </Text>
        </View>
        <FlatList
          data={progress}
          renderItem={this.renderProgressEntry}
          style={listStyles.liContainer}
        />
      </SafeAreaView>
    )
  }
}

var listStyles = StyleSheet.create({
  li: {
    borderBottomColor: '#c8c7cc',
    borderBottomWidth: 0.5,
    paddingTop: 15,
    paddingRight: 15,
    paddingBottom: 15
  },
  liContainer: {
    backgroundColor: '#fff',
    flex: 1,
    paddingLeft: 15
  },
  liIndent: {
    flex: 1
  },
  liText: {
    color: '#333',
    fontSize: 17,
    fontWeight: '400',
    marginBottom: -3.5,
    marginTop: -3.5
  }
})

var styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF'
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5
  },
  toolbar: {
    backgroundColor: '#51c04d',
    flexDirection: 'row',
    height: 44,
    justifyContent: 'center',
    alignItems: 'center'
  },
  toolbarButton: {
    color: 'white',
    textAlign: 'center',
    flex: 1
  },
  mainContainer: {
    flex: 1
  }
})
