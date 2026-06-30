import { HeaderBackButton } from "@react-navigation/elements";
import { router, useNavigation } from "expo-router";

export function NestedStackHomeBackButton(props: { tintColor?: string }) {
  const navigation = useNavigation();

  function onPress() {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    let parent = navigation.getParent();
    while (parent) {
      if (parent.canGoBack()) {
        parent.goBack();
        return;
      }
      parent = parent.getParent();
    }

    router.replace("/(app)" as never);
  }

  return <HeaderBackButton tintColor={props.tintColor} onPress={onPress} />;
}
