/**
 * Copyright (C) 2016 Mailvelope GmbH
 * Licensed under the GNU Affero General Public License version 3
 */

import mvelo from '../../mvelo';
import {port, getAppDataSlot} from '../app';
import {KeyringOptions} from './Keyring';
import * as l10n from '../../lib/l10n';
import React from 'react';
import PropTypes from 'prop-types';

import KeySearch from './components/KeySearch';
import Alert from '../../components/util/Alert';
import {Link} from 'react-router-dom';

const PUBLIC_KEY_REGEX = /-----BEGIN PGP PUBLIC KEY BLOCK-----[\s\S]+?-----END PGP PUBLIC KEY BLOCK-----/g;
const PRIVATE_KEY_REGEX = /-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]+?-----END PGP PRIVATE KEY BLOCK-----/g;
const MAX_KEY_IMPORT_SIZE = 10000000;

l10n.register([
  'key_import_error',
  'key_import_too_big',
  'key_import_invalid_text',
  'key_import_exception',
  'alert_header_warning',
  'alert_header_success',
  'keyring_import_keys',
  'key_import_file',
  'key_import_file_select',
  'key_import_textarea',
  'key_import_multiple_keys',
  'form_import',
  'form_clear'
]);

class ImportKeyBase extends React.Component {
  constructor(props) {
    super(props);
    this.state = {alert: [], armored: ''};
    this.handleChangeFile = this.handleChangeFile.bind(this);
  }

  componentDidMount() {
    // key import push scenario
    if (/\/push$/.test(this.props.location.pathname)) {
      getAppDataSlot()
      .then(armored => this.importKey(armored));
    }
  }

  handleChangeFile(event) {
    const alert = [];
    const reader = new FileReader();
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    reader.onloadend = ev => this.handleImportKey(ev.target.result);
    if (file.size > MAX_KEY_IMPORT_SIZE) {
      alert.push({header: l10n.map.key_import_error, message: l10n.map.key_import_too_big, type: 'danger'});
    } else {
      reader.readAsText(file);
    }
    this.setState({alert});
    // reset input field
    event.target.value = null;
  }

  importKey(armored) {
    this.setState({armored, alert: []});
    this.handleImportKey(armored);
  }

  async handleImportKey(armored) {
    const alert = [];
    this.setState({alert: []});
    try {
      if (armored.length > MAX_KEY_IMPORT_SIZE) {
        throw {message: l10n.map.key_import_too_big, type: 'error'};
      }
      // find all public and private keys in the textbox
      const publicKeys = armored.match(PUBLIC_KEY_REGEX);
      const privateKeys = armored.match(PRIVATE_KEY_REGEX);
      const keys = [];
      if (publicKeys) {
        publicKeys.forEach(pub => {
          pub = mvelo.util.normalizeArmored(pub);
          keys.push({type: 'public', armored: pub});
        });
      }
      if (privateKeys) {
        privateKeys.forEach(priv => {
          priv = mvelo.util.normalizeArmored(priv);
          keys.push({type: 'private', armored: priv});
        });
      }
      if (!keys.length) {
        throw {message: l10n.map.key_import_invalid_text, type: 'error'};
      }
      const result = await port.send('importKeys', {keyringId: this.props.keyringId, keys});
      result.forEach(imported => {
        let header;
        const {message} = imported;
        let {type} = imported;
        switch (imported.type) {
          case 'success':
            header = l10n.map.alert_header_success;
            break;
          case 'warning':
            header = l10n.map.alert_header_warning;
            break;
          case 'error':
            header = l10n.map.key_import_error;
            type = 'danger';
            break;
        }
        alert.push({header, message, type});
      });
      this.setState({alert});
    } catch (error) {
      alert.push({header: l10n.map.key_import_error, message: error.type === 'error' ? error.message : l10n.map.key_import_exception, type: 'danger'});
      this.setState({alert});
    }
  }

  render() {
    return (
      <div>
        <h3 className="logo-header">
          <span>{l10n.map.keyring_import_keys}</span>
        </h3>
        {!this.props.demail && <KeySearch prefs={this.props.prefs} />}
        <form className="form" autoComplete="off">
          <div className="form-group">
            <label className="control-label" htmlFor="selectFileButton"><h4>{l10n.map.key_import_file}</h4></label>
            <div>
              <button id="selectFileButton" type="button" onClick={() => this.fileInput.click()} className="btn btn-info">{l10n.map.key_import_file_select}</button>
              <input type="file" onChange={this.handleChangeFile} style={{display: 'none'}} ref={node => this.fileInput = node} />
            </div>
          </div>
          <div className="form-group">
            <label className="control-label" htmlFor="newKey"><h4>{l10n.map.key_import_textarea}</h4></label>
            <div>{l10n.map.key_import_multiple_keys}</div>
            <div className="help-block">
              <textarea id="newKey" value={this.state.armored} onChange={event => this.setState({armored: event.target.value})} style={{width: '100%', fontFamily: 'monospace'}} className="form-control" rows="12" spellCheck="false" autoComplete="off"></textarea>
            </div>
          </div>
          <div className="form-group">
            <button type="button" onClick={() => this.handleImportKey(this.state.armored)} className="btn btn-primary" disabled={!this.state.armored}>{l10n.map.form_import}</button>
            <Link className="btn btn-default" to='/keyring' onClick={this.props.onKeyringChange} replace tabIndex="0">
              <span>{l10n.map.action_menu_back}</span>
            </Link>
          </div>
          <div className="form-group">
            {this.state.alert.map((alert, index) => <Alert header={alert.header} message={alert.message} type={alert.type} key={index} />)}
          </div>
        </form>
      </div>
    );
  }
}

ImportKeyBase.propTypes = {
  keyringId: PropTypes.string,
  demail: PropTypes.bool,
  onKeyringChange: PropTypes.func,
  prefs: PropTypes.object,
  location: PropTypes.object
};

export default function ImportKey(props) {
  return (
    <KeyringOptions.Consumer>
      {options => <ImportKeyBase {...props} keyringId={options.keyringId} demail={options.demail} />}
    </KeyringOptions.Consumer>
  );
}
