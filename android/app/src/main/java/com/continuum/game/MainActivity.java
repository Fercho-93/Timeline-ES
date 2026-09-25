package com.continuum.game;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override public void onCreate(Bundle savedInstanceState) {
    registerPlugin(LocalLanSignalPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
